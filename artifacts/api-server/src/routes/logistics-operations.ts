import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import {
  ApproveLogisticsOfferParams,
  ApproveLogisticsOfferBody,
  CreateLogisticsCarrierBody,
  CreateLogisticsFieldIntakeBody,
  CreateLogisticsFieldIntakeResponse,
  CreateLogisticsCommunicationBody,
  CreateLogisticsOfferBody,
  CreateLogisticsRequestBody,
  CreateLogisticsRequestResponse,
  CreateLogisticsCarrierResponse,
  CreateLogisticsOfferResponse,
  CreateLogisticsCommunicationResponse,
  UpdateLogisticsRequestStatusResponse,
  GetLogisticsOperationsQueryParams,
  GetLogisticsOperationsResponse,
  ReviewLogisticsCarrierBody,
  ReviewLogisticsCarrierParams,
  ReviseLogisticsOfferBody,
  ReviseLogisticsOfferParams,
  DecideLogisticsOfferBody,
  DecideLogisticsOfferParams,
  MarkLogisticsOfferSentBody,
  UpdateLogisticsRequestStatusBody,
  UpdateLogisticsRequestStatusParams,
} from "@workspace/api-zod";
import {
  db,
  logisticsCarriersTable,
  logisticsCommunicationsTable,
  logisticsOffersTable,
  logisticsRequestsTable,
  logisticsShipmentsTable,
  staffUsersTable,
  type LogisticsCarrier,
  type LogisticsCommunication,
  type LogisticsOffer,
  type LogisticsRequest,
  type LogisticsShipment,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { requireLogisticsOperator, requireLogisticsFounder } from "../lib/logisticsWorkflowAuth";
import { ensureLogisticsAutomation } from "../lib/logisticsAutomation";
import {
  LogisticsWorkflowError, saveLogisticsOffer, approveLogisticsOffer,
  markLogisticsOfferSent, decideLogisticsOffer, reviewLogisticsCarrier, updateLogisticsShipment,
} from "../lib/logisticsWorkflow";

const router: IRouter = Router();

async function runWorkflow<T>(req: Request, res: Response, action: () => Promise<T>,
  serialize: (row: T) => unknown, successStatus = 200): Promise<void> {
  try {
    const row = await action();
    res.status(successStatus).json(serialize(row));
  } catch (error) {
    if (error instanceof LogisticsWorkflowError) {
      res.status(error.status).json({ error: error.message }); return;
    }
    req.log?.error({ errorType: error instanceof Error ? error.name : "unknown" }, "Logistics workflow persistence failed");
    res.status(503).json({ error: "Kayıt işlemi tamamlanamadı. Yenileyip kayıt durumunu kontrol edin." });
  }
}

function referenceCode(prefix: string) {
  return `${prefix}-${new Date().getUTCFullYear()}-${randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function iso(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

function serializeRequest(
  request: LogisticsRequest,
  shipment?: LogisticsShipment,
) {
  return CreateLogisticsRequestResponse.parse({
    id: request.id,
    referenceCode: request.referenceCode,
    requesterName: request.requesterName,
    organization: request.organization,
    email: request.email,
    phone: request.phone,
    origin: request.origin,
    destination: request.destination,
    cargoType: request.cargoType,
    weightKg: request.weightKg,
    volumeM3: request.volumeM3,
    transportMode: request.transportMode,
    loadingDate: request.loadingDate,
    notes: request.notes,
    status: shipment?.status ?? "new_request",
    isTest: request.isTest,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  });
}

function serializeCarrier(carrier: LogisticsCarrier) {
  return CreateLogisticsCarrierResponse.parse({
    id: carrier.id,
    referenceCode: carrier.referenceCode,
    companyName: carrier.companyName,
    contactName: carrier.contactName,
    email: carrier.email,
    phone: carrier.phone,
    serviceRoutes: carrier.serviceRoutes,
    transportMode: carrier.transportMode,
    capacity: carrier.capacity,
    availability: carrier.availability,
    notes: carrier.notes,
    status: carrier.status,
    isTest: carrier.isTest,
    reviewedAt: iso(carrier.reviewedAt),
    createdAt: carrier.createdAt.toISOString(),
    updatedAt: carrier.updatedAt.toISOString(),
  });
}

function serializeShipment(shipment: LogisticsShipment) {
  return UpdateLogisticsRequestStatusResponse.parse({
    id: shipment.id,
    requestId: shipment.requestId,
    referenceCode: shipment.referenceCode,
    status: shipment.status,
    assignedStaffClerkUserId: shipment.assignedStaffClerkUserId,
    plannedLoadingAt: iso(shipment.plannedLoadingAt),
    actualLoadingAt: iso(shipment.actualLoadingAt),
    plannedDeliveryAt: iso(shipment.plannedDeliveryAt),
    actualDeliveryAt: iso(shipment.actualDeliveryAt),
    internalNote: shipment.internalNote,
    createdAt: shipment.createdAt.toISOString(),
    updatedAt: shipment.updatedAt.toISOString(),
  });
}

function serializeOffer(offer: LogisticsOffer) {
  return CreateLogisticsOfferResponse.parse({
    id: offer.id,
    requestId: offer.requestId,
    carrierId: offer.carrierId,
    carrierCostAmount: offer.carrierCostAmount,
    customerPriceAmount: offer.customerPriceAmount,
    currency: offer.currency,
    includedServices: offer.includedServices,
    validUntil: offer.validUntil.toISOString(),
    status: offer.status,
    createdByClerkUserId: offer.createdByClerkUserId,
    approvedByClerkUserId: offer.approvedByClerkUserId,
    approvedAt: iso(offer.approvedAt),
    sentAt: iso(offer.sentAt),
    isTest: offer.isTest,
    createdAt: offer.createdAt.toISOString(),
    updatedAt: offer.updatedAt.toISOString(),
  });
}

function serializeCommunication(communication: LogisticsCommunication) {
  return CreateLogisticsCommunicationResponse.parse({
    id: communication.id,
    requestId: communication.requestId,
    channel: communication.channel,
    direction: communication.direction,
    message: communication.message,
    createdByClerkUserId: communication.createdByClerkUserId,
    isTest: communication.isTest,
    createdAt: communication.createdAt.toISOString(),
  });
}

router.post("/logistics/requests", async (req, res): Promise<void> => {
  const parsed = CreateLogisticsRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Yük talebi bilgileri geçersiz.",
    });
    return;
  }

  const input = parsed.data;
  if ([input.requesterName, input.email, input.phone, input.origin, input.destination, input.cargoType].some(x => !x.trim())) {
    res.status(400).json({ error: "Zorunlu yük talebi alanları boş bırakılamaz." }); return;
  }
  const created = await db.transaction(async (tx) => {
    const [request] = await tx
      .insert(logisticsRequestsTable)
      .values({
        referenceCode: referenceCode("LOAD"),
        requesterName: input.requesterName.trim(),
        requesterClerkUserId: getAuth(req).userId ?? null,
        organization: input.organization?.trim() || null,
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        origin: input.origin.trim(),
        destination: input.destination.trim(),
        cargoType: input.cargoType.trim(),
        weightKg: input.weightKg,
        volumeM3: input.volumeM3,
        transportMode: input.transportMode,
        loadingDate: input.loadingDate.toISOString().slice(0, 10),
        notes: input.notes?.trim() || null,
        isTest: input.isTest ?? false,
      })
      .returning();
    const [shipment] = await tx
      .insert(logisticsShipmentsTable)
      .values({
        requestId: request.id,
        referenceCode: request.referenceCode,
        status: "new_request",
      })
      .returning();
    await ensureLogisticsAutomation(tx, request);
    return { request, shipment };
  });

  req.log.info(
    { requestId: created.request.id, referenceCode: created.request.referenceCode },
    "Logistics load request submitted",
  );
  res.status(201).json(serializeRequest(created.request, created.shipment));
});

router.post("/logistics/carriers", async (req, res): Promise<void> => {
  const parsed = CreateLogisticsCarrierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error:
        parsed.error.issues[0]?.message ??
        "Taşıyıcı başvurusu bilgileri geçersiz.",
    });
    return;
  }

  const input = parsed.data;
  if ([input.companyName, input.contactName, input.email, input.phone, input.serviceRoutes, input.capacity, input.availability].some(x => !x.trim())) {
    res.status(400).json({ error: "Zorunlu taşıyıcı başvuru alanları boş bırakılamaz." }); return;
  }
  const [carrier] = await db
    .insert(logisticsCarriersTable)
    .values({
      referenceCode: referenceCode("CARRIER"),
      companyName: input.companyName.trim(),
      applicantClerkUserId: getAuth(req).userId ?? null,
      contactName: input.contactName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      serviceRoutes: input.serviceRoutes.trim(),
      transportMode: input.transportMode,
      capacity: input.capacity.trim(),
      availability: input.availability.trim(),
      notes: input.notes?.trim() || null,
      status: "pending",
      isTest: input.isTest ?? false,
    })
    .returning();

  req.log.info(
    { carrierId: carrier.id, referenceCode: carrier.referenceCode },
    "Logistics carrier application submitted",
  );
  res.status(201).json(serializeCarrier(carrier));
});

// Field capture is internal: never attribute the customer/carrier to the
// employee entering the form, and never treat contact consent as permission
// to send messages or publish their information.
router.post("/logistics/field-intake", async (req, res): Promise<void> => {
  const actor = await requireLogisticsOperator(req, res);
  if (!actor) return;
  const parsed = CreateLogisticsFieldIntakeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Saha kaydı geçersiz." });
    return;
  }
  const input = parsed.data;
  if (input.contactUseConfirmed !== true) {
    res.status(400).json({ error: "Kişinin MMT içi eşleştirme için iletişim izni teyit edilmelidir." });
    return;
  }
  if ((input.notes?.trim().length ?? 0) < 10) {
    res.status(400).json({ error: "Kaynağı ve kayıt/eşleştirme izninin nasıl teyit edildiğini en az 10 karakterle açıklayın." });
    return;
  }
  const requiredValues = input.type === "load"
    ? [input.requesterName, input.email, input.phone, input.region, input.destination, input.cargoType]
    : [input.companyName, input.contactName, input.email, input.phone, input.region, input.targetDestination, input.capacity];
  if (requiredValues.some(value => !value.trim())) {
    res.status(400).json({ error: "Sahada alınan zorunlu bilgi alanları boş bırakılamaz." });
    return;
  }
  const availableOn = input.type === "load" ? input.loadingDate : input.availability;
  if (availableOn.toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)) {
    res.status(400).json({ error: "Yükleme veya araç müsaitlik tarihi geçmiş olamaz." });
    return;
  }
  try {
    if (input.type === "load") {
      const [record] = await db.transaction(async tx => {
        const reference = referenceCode("LOAD");
        const [created] = await tx.insert(logisticsRequestsTable).values({
          referenceCode: reference,
          requesterClerkUserId: null,
          capturedByClerkUserId: actor.userId,
          contactUseConfirmed: true,
          requesterName: input.requesterName.trim(),
          organization: input.organization?.trim() || null,
          email: input.email.trim().toLowerCase(),
          phone: input.phone.trim(),
          origin: input.region,
          destination: input.destination.trim(),
          cargoType: input.cargoType.trim(),
          weightKg: input.weightKg,
          volumeM3: input.volumeM3,
          transportMode: input.transportMode,
          loadingDate: input.loadingDate.toISOString().slice(0, 10),
          notes: input.notes?.trim() || null,
          isTest: false,
        }).returning();
        await tx.insert(logisticsShipmentsTable).values({
          requestId: created.id,
          referenceCode: created.referenceCode,
          status: "new_request",
        });
        await ensureLogisticsAutomation(tx, created, actor);
        return [created] as const;
      });
      req.log?.info({ requestId: record.id, capturedBy: actor.userId }, "Authorized Mersin field load captured");
      res.status(201).json(CreateLogisticsFieldIntakeResponse.parse({
        recordType: "load", id: record.id, referenceCode: record.referenceCode,
        status: "new_request", createdAt: record.createdAt.toISOString(),
      }));
      return;
    }
    const [carrier] = await db.insert(logisticsCarriersTable).values({
      referenceCode: referenceCode("CARRIER"),
      applicantClerkUserId: null,
      capturedByClerkUserId: actor.userId,
      contactUseConfirmed: true,
      companyName: input.companyName.trim(),
      contactName: input.contactName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      serviceRoutes: `${input.region} → ${input.targetDestination}`,
      transportMode: input.transportMode,
      capacity: input.capacity.trim(),
      availability: input.availability.toISOString().slice(0, 10),
      notes: input.notes?.trim() || null,
      status: "pending",
      isTest: false,
    }).returning();
    req.log?.info({ carrierId: carrier.id, capturedBy: actor.userId }, "Authorized empty truck field lead captured");
    res.status(201).json(CreateLogisticsFieldIntakeResponse.parse({
      recordType: "empty_truck", id: carrier.id, referenceCode: carrier.referenceCode,
      status: carrier.status, createdAt: carrier.createdAt.toISOString(),
    }));
  } catch {
    req.log?.error({ capturedBy: actor.userId }, "Authorized field intake could not be recorded");
    res.status(503).json({ error: "Saha kaydı tamamlanamadı. Kaydın oluşup oluşmadığını kontrol edip yeniden deneyin." });
  }
});

router.get("/logistics/staff", async (req, res): Promise<void> => {
  const authorization = await requireLogisticsOperator(req, res);
  if (!authorization) return;

  const staff = await db
    .select({
      id: staffUsersTable.id,
      clerkUserId: staffUsersTable.clerkUserId,
      email: staffUsersTable.email,
      role: staffUsersTable.role,
    })
    .from(staffUsersTable)
    .where(eq(staffUsersTable.active, 1))
    .orderBy(staffUsersTable.email);
  res.json(staff);
});

router.get("/logistics/operations", async (req, res): Promise<void> => {
  const authorization = await requireLogisticsOperator(req, res);
  if (!authorization) return;

  const parsed = GetLogisticsOperationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Operasyon filtreleri geçersiz." });
    return;
  }

  const { requestId, status } = parsed.data;
  const shipmentWhere = and(
    requestId ? eq(logisticsShipmentsTable.requestId, requestId) : undefined,
    status ? eq(logisticsShipmentsTable.status, status) : undefined,
  );
  const requestWhere = requestId
    ? eq(logisticsRequestsTable.id, requestId)
    : undefined;
  const offerWhere = requestId
    ? eq(logisticsOffersTable.requestId, requestId)
    : undefined;
  const communicationWhere = requestId
    ? eq(logisticsCommunicationsTable.requestId, requestId)
    : undefined;

  const [requests, carriers, shipments, offers, communications, staff] =
    await Promise.all([
      db
        .select()
        .from(logisticsRequestsTable)
        .where(requestWhere)
        .orderBy(desc(logisticsRequestsTable.createdAt)),
      db
        .select()
        .from(logisticsCarriersTable)
        .orderBy(desc(logisticsCarriersTable.createdAt)),
      db
        .select()
        .from(logisticsShipmentsTable)
        .where(shipmentWhere)
        .orderBy(desc(logisticsShipmentsTable.updatedAt)),
      db
        .select()
        .from(logisticsOffersTable)
        .where(offerWhere)
        .orderBy(desc(logisticsOffersTable.createdAt)),
      db
        .select()
        .from(logisticsCommunicationsTable)
        .where(communicationWhere)
        .orderBy(desc(logisticsCommunicationsTable.createdAt)),
      db
        .select({
          id: staffUsersTable.id,
          clerkUserId: staffUsersTable.clerkUserId,
          email: staffUsersTable.email,
          role: staffUsersTable.role,
        })
        .from(staffUsersTable)
        .where(eq(staffUsersTable.active, 1))
        .orderBy(staffUsersTable.email),
    ]);

  const shipmentByRequest = new Map(shipments.map((shipment) => [shipment.requestId, shipment]));
  const included = (id: number) => !status || shipmentByRequest.has(id);
  res.setHeader("Cache-Control", "no-store");
  res.json(GetLogisticsOperationsResponse.parse({
    canApprove: authorization.isFounder,
    requests: requests.filter(request => included(request.id)).map((request) =>
      serializeRequest(request, shipmentByRequest.get(request.id)),
    ),
    carriers: carriers.map(serializeCarrier),
    shipments: shipments.map(serializeShipment),
    offers: offers.filter(offer => included(offer.requestId)).map(serializeOffer),
    communications: communications.filter(row => included(row.requestId)).map(serializeCommunication),
    staff,
  }));
});

router.patch(
  "/logistics/requests/:id/status",
  async (req, res): Promise<void> => {
    const authorization = await requireLogisticsOperator(req, res);
    if (!authorization) return;

    const params = UpdateLogisticsRequestStatusParams.safeParse(req.params);
    const body = UpdateLogisticsRequestStatusBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Operasyon durum güncellemesi geçersiz." });
      return;
    }

    await runWorkflow(req, res, () => updateLogisticsShipment(params.data.id, body.data, authorization), serializeShipment);
  },
);

router.post("/logistics/offers", async (req, res): Promise<void> => {
  const authorization = await requireLogisticsOperator(req, res);
  if (!authorization) return;

  const parsed = CreateLogisticsOfferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Teklif bilgileri geçersiz." });
    return;
  }
  await runWorkflow(req, res, () => saveLogisticsOffer(parsed.data, authorization), serializeOffer, 201);
});

router.post(
  "/logistics/offers/:id/approve",
  async (req, res): Promise<void> => {
    const authorization = requireLogisticsFounder(req, res);
    if (!authorization) return;

    const params = ApproveLogisticsOfferParams.safeParse(req.params);
    const body = ApproveLogisticsOfferBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Teklif numarası geçersiz." });
      return;
    }
    await runWorkflow(req, res, () => approveLogisticsOffer(params.data.id, authorization, body.data.expectedUpdatedAt), serializeOffer);
  },
);

router.post(
  "/logistics/offers/:id/mark-sent",
  async (req, res): Promise<void> => {
    const authorization = await requireLogisticsOperator(req, res);
    if (!authorization) return;

    const params = ApproveLogisticsOfferParams.safeParse(req.params);
    const body = MarkLogisticsOfferSentBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Teklif numarası geçersiz." });
      return;
    }
    await runWorkflow(req, res, () => markLogisticsOfferSent(params.data.id, authorization, body.data), serializeOffer);
  },
);

router.post("/logistics/communications", async (req, res): Promise<void> => {
  const authorization = await requireLogisticsOperator(req, res);
  if (!authorization) return;

  const parsed = CreateLogisticsCommunicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "İletişim kaydı geçersiz." });
    return;
  }
  const input = parsed.data;
  const [request] = await db
    .select({ id: logisticsRequestsTable.id, isTest: logisticsRequestsTable.isTest })
    .from(logisticsRequestsTable)
    .where(eq(logisticsRequestsTable.id, input.requestId))
    .limit(1);
  if (!request) {
    res.status(404).json({ error: "Yük talebi bulunamadı." });
    return;
  }
  if (!input.message.trim() || (input.isTest !== undefined && input.isTest !== request.isTest)) {
    res.status(400).json({ error: "İletişim notu boş olamaz; TEST durumu yük talebiyle aynı olmalıdır." }); return;
  }

  const [communication] = await db
    .insert(logisticsCommunicationsTable)
    .values({
      requestId: input.requestId,
      channel: input.channel,
      direction: input.direction,
      message: input.message.trim(),
      createdByClerkUserId: authorization.userId,
      isTest: request.isTest,
    })
    .returning();
  res.status(201).json(serializeCommunication(communication));
});

router.post("/logistics/carriers/:id/review", async (req, res): Promise<void> => {
  const actor = requireLogisticsFounder(req, res);
  if (!actor) return;
  const params = ReviewLogisticsCarrierParams.safeParse(req.params);
  const body = ReviewLogisticsCarrierBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Taşıyıcı değerlendirmesi geçersiz." }); return; }
  await runWorkflow(req, res, () => reviewLogisticsCarrier(params.data.id, body.data.status, body.data.note, actor), serializeCarrier);
});

router.patch("/logistics/offers/:id", async (req, res): Promise<void> => {
  const actor = requireLogisticsFounder(req, res);
  if (!actor) return;
  const params = ReviseLogisticsOfferParams.safeParse(req.params);
  const body = ReviseLogisticsOfferBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Teklif revizyonu geçersiz." }); return; }
  await runWorkflow(req, res, () => saveLogisticsOffer(body.data, actor, params.data.id), serializeOffer);
});

router.post("/logistics/offers/:id/decision", async (req, res): Promise<void> => {
  const actor = requireLogisticsFounder(req, res);
  if (!actor) return;
  const params = DecideLogisticsOfferParams.safeParse(req.params);
  const body = DecideLogisticsOfferBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Teklif kararı geçersiz." }); return; }
  await runWorkflow(req, res, () => decideLogisticsOffer(params.data.id, actor, body.data), serializeOffer);
});

export default router;