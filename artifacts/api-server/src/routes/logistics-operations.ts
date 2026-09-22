import { Router, type IRouter } from "express";
import {
  ApproveLogisticsOfferParams,
  CreateLogisticsCarrierBody,
  CreateLogisticsCommunicationBody,
  CreateLogisticsOfferBody,
  CreateLogisticsRequestBody,
  GetLogisticsOperationsQueryParams,
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
import { and, desc, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { requireStaff } from "../lib/staffAuth";

const router: IRouter = Router();

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
  return {
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
  };
}

function serializeCarrier(carrier: LogisticsCarrier) {
  return {
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
  };
}

function serializeShipment(shipment: LogisticsShipment) {
  return {
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
  };
}

function serializeOffer(offer: LogisticsOffer) {
  return {
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
  };
}

function serializeCommunication(communication: LogisticsCommunication) {
  return {
    id: communication.id,
    requestId: communication.requestId,
    channel: communication.channel,
    direction: communication.direction,
    message: communication.message,
    createdByClerkUserId: communication.createdByClerkUserId,
    isTest: communication.isTest,
    createdAt: communication.createdAt.toISOString(),
  };
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
  const created = await db.transaction(async (tx) => {
    const [request] = await tx
      .insert(logisticsRequestsTable)
      .values({
        referenceCode: referenceCode("LOAD"),
        requesterName: input.requesterName.trim(),
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
  const [carrier] = await db
    .insert(logisticsCarriersTable)
    .values({
      referenceCode: referenceCode("CARRIER"),
      companyName: input.companyName.trim(),
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

router.get("/logistics/staff", async (req, res): Promise<void> => {
  const authorization = await requireStaff(req, res);
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
  const authorization = await requireStaff(req, res);
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
  res.json({
    requests: requests.map((request) =>
      serializeRequest(request, shipmentByRequest.get(request.id)),
    ),
    carriers: carriers.map(serializeCarrier),
    shipments: shipments.map(serializeShipment),
    offers: offers.map(serializeOffer),
    communications: communications.map(serializeCommunication),
    staff,
  });
});

router.patch(
  "/logistics/requests/:id/status",
  async (req, res): Promise<void> => {
    const authorization = await requireStaff(req, res);
    if (!authorization) return;

    const params = UpdateLogisticsRequestStatusParams.safeParse(req.params);
    const body = UpdateLogisticsRequestStatusBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Operasyon durum güncellemesi geçersiz." });
      return;
    }

    const [existing] = await db
      .select()
      .from(logisticsShipmentsTable)
      .where(eq(logisticsShipmentsTable.requestId, params.data.id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Lojistik iş kaydı bulunamadı." });
      return;
    }

    if (body.data.assignedStaffClerkUserId) {
      const [assignedStaff] = await db
        .select({ clerkUserId: staffUsersTable.clerkUserId })
        .from(staffUsersTable)
        .where(
          and(
            eq(staffUsersTable.clerkUserId, body.data.assignedStaffClerkUserId),
            eq(staffUsersTable.active, 1),
          ),
        )
        .limit(1);
      if (!assignedStaff) {
        res.status(400).json({ error: "Sorumlu personel bulunamadı." });
        return;
      }
    }

    const now = new Date();
    const [updated] = await db
      .update(logisticsShipmentsTable)
      .set({
        status: body.data.status,
        assignedStaffClerkUserId:
          body.data.assignedStaffClerkUserId === undefined
            ? existing.assignedStaffClerkUserId
            : body.data.assignedStaffClerkUserId,
        plannedLoadingAt:
          body.data.plannedLoadingAt === undefined
            ? existing.plannedLoadingAt
            : body.data.plannedLoadingAt,
        plannedDeliveryAt:
          body.data.plannedDeliveryAt === undefined
            ? existing.plannedDeliveryAt
            : body.data.plannedDeliveryAt,
        internalNote:
          body.data.internalNote === undefined
            ? existing.internalNote
            : body.data.internalNote?.trim() || null,
        actualLoadingAt:
          body.data.status === "loading"
            ? existing.actualLoadingAt ?? now
            : existing.actualLoadingAt,
        actualDeliveryAt:
          body.data.status === "delivered"
            ? existing.actualDeliveryAt ?? now
            : existing.actualDeliveryAt,
      })
      .where(eq(logisticsShipmentsTable.id, existing.id))
      .returning();

    req.log.info(
      {
        requestId: params.data.id,
        previousStatus: existing.status,
        nextStatus: updated.status,
        staffUserId: authorization.userId,
      },
      "Logistics shipment status updated",
    );
    res.json(serializeShipment(updated));
  },
);

router.post("/logistics/offers", async (req, res): Promise<void> => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;

  const parsed = CreateLogisticsOfferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Teklif bilgileri geçersiz." });
    return;
  }
  const input = parsed.data;
  const [[request], [carrier]] = await Promise.all([
    db
      .select({ id: logisticsRequestsTable.id })
      .from(logisticsRequestsTable)
      .where(eq(logisticsRequestsTable.id, input.requestId))
      .limit(1),
    db
      .select({ id: logisticsCarriersTable.id, status: logisticsCarriersTable.status })
      .from(logisticsCarriersTable)
      .where(eq(logisticsCarriersTable.id, input.carrierId))
      .limit(1),
  ]);
  if (!request) {
    res.status(404).json({ error: "Yük talebi bulunamadı." });
    return;
  }
  if (!carrier || carrier.status !== "approved") {
    res.status(400).json({ error: "Teklif için onaylı taşıyıcı seçilmelidir." });
    return;
  }

  const [offer] = await db
    .insert(logisticsOffersTable)
    .values({
      requestId: input.requestId,
      carrierId: input.carrierId,
      carrierCostAmount: input.carrierCostAmount,
      customerPriceAmount: input.customerPriceAmount,
      currency: input.currency.trim().toUpperCase(),
      includedServices: input.includedServices.trim(),
      validUntil: input.validUntil,
      status: "pending_approval",
      createdByClerkUserId: authorization.userId,
      isTest: input.isTest ?? false,
    })
    .returning();
  res.status(201).json(serializeOffer(offer));
});

router.post(
  "/logistics/offers/:id/approve",
  async (req, res): Promise<void> => {
    const authorization = await requireStaff(req, res);
    if (!authorization) return;
    if (authorization.staff.role !== "admin") {
      res.status(403).json({ error: "Teklif onayı için yönetici yetkisi gerekiyor." });
      return;
    }

    const params = ApproveLogisticsOfferParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Teklif numarası geçersiz." });
      return;
    }
    const [existing] = await db
      .select()
      .from(logisticsOffersTable)
      .where(eq(logisticsOffersTable.id, params.data.id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Teklif bulunamadı." });
      return;
    }
    if (existing.status !== "pending_approval") {
      res.status(400).json({ error: "Bu teklif artık yönetici onayı beklemiyor." });
      return;
    }

    const [updated] = await db
      .update(logisticsOffersTable)
      .set({
        status: "approved",
        approvedByClerkUserId: authorization.userId,
        approvedAt: new Date(),
      })
      .where(eq(logisticsOffersTable.id, existing.id))
      .returning();
    res.json(serializeOffer(updated));
  },
);

router.post(
  "/logistics/offers/:id/mark-sent",
  async (req, res): Promise<void> => {
    const authorization = await requireStaff(req, res);
    if (!authorization) return;

    const params = ApproveLogisticsOfferParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Teklif numarası geçersiz." });
      return;
    }
    const [existing] = await db
      .select()
      .from(logisticsOffersTable)
      .where(eq(logisticsOffersTable.id, params.data.id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Teklif bulunamadı." });
      return;
    }
    if (existing.status !== "approved") {
      res.status(400).json({ error: "Teklif önce yönetici tarafından onaylanmalıdır." });
      return;
    }
    const [updated] = await db
      .update(logisticsOffersTable)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(logisticsOffersTable.id, existing.id))
      .returning();
    req.log.info(
      { offerId: updated.id, requestId: updated.requestId, staffUserId: authorization.userId },
      "Logistics offer manually marked as sent",
    );
    res.json(serializeOffer(updated));
  },
);

router.post("/logistics/communications", async (req, res): Promise<void> => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;

  const parsed = CreateLogisticsCommunicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "İletişim kaydı geçersiz." });
    return;
  }
  const input = parsed.data;
  const [request] = await db
    .select({ id: logisticsRequestsTable.id })
    .from(logisticsRequestsTable)
    .where(eq(logisticsRequestsTable.id, input.requestId))
    .limit(1);
  if (!request) {
    res.status(404).json({ error: "Yük talebi bulunamadı." });
    return;
  }

  const [communication] = await db
    .insert(logisticsCommunicationsTable)
    .values({
      requestId: input.requestId,
      channel: input.channel,
      direction: input.direction,
      message: input.message.trim(),
      createdByClerkUserId: authorization.userId,
      isTest: input.isTest ?? false,
    })
    .returning();
  res.status(201).json(serializeCommunication(communication));
});

export default router;