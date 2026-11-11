import { Router, type IRouter } from "express";
import {
  CreateStaffRewardPlanBody,
  CreateStaffRewardTransactionBody,
  DecideStaffRewardTransactionBody,
  DecideStaffRewardTransactionParams,
} from "@workspace/api-zod";
import {
  db,
  staffRewardPlansTable,
  staffRewardTransactionsTable,
  staffUsersTable,
  type StaffRewardPlan,
  type StaffRewardTransaction,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireStaff } from "../lib/staffAuth";

const router: IRouter = Router();

function serializePlan(plan: StaffRewardPlan, staffEmail: string) {
  return {
    id: plan.id,
    staffUserId: plan.staffUserId,
    staffEmail,
    name: plan.name,
    monthlyPoints: plan.monthlyPoints,
    monthlyCashAmount: Number(plan.monthlyCashAmount),
    currency: plan.currency,
    holidayPackageBudget: Number(plan.holidayPackageBudget),
    internationalTravelBudget: Number(plan.internationalTravelBudget),
    customBenefits: plan.customBenefits,
    status: plan.status,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function serializeTransaction(
  transaction: StaffRewardTransaction,
  staffEmail: string,
) {
  return {
    id: transaction.id,
    staffUserId: transaction.staffUserId,
    staffEmail,
    planId: transaction.planId,
    kind: transaction.kind,
    pointsDelta: transaction.pointsDelta,
    cashAmount: Number(transaction.cashAmount),
    currency: transaction.currency,
    title: transaction.title,
    reason: transaction.reason,
    status: transaction.status,
    createdAt: transaction.createdAt.toISOString(),
  };
}

router.get("/staff/rewards", async (req, res): Promise<void> => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;

  const canSeeAll =
    authorization.staff.role === "admin" ||
    authorization.staff.role === "operations";
  const staffUsers = await db
    .select()
    .from(staffUsersTable)
    .where(
      canSeeAll
        ? eq(staffUsersTable.active, 1)
        : and(
            eq(staffUsersTable.active, 1),
            eq(staffUsersTable.clerkUserId, authorization.userId),
          ),
    )
    .orderBy(staffUsersTable.email);
  const staffIds = staffUsers.map((staff) => staff.id);
  if (staffIds.length === 0) {
    res.json({ items: [] });
    return;
  }

  const [plans, transactions] = await Promise.all([
    db
      .select()
      .from(staffRewardPlansTable)
      .where(inArray(staffRewardPlansTable.staffUserId, staffIds))
      .orderBy(desc(staffRewardPlansTable.createdAt)),
    db
      .select()
      .from(staffRewardTransactionsTable)
      .where(inArray(staffRewardTransactionsTable.staffUserId, staffIds))
      .orderBy(desc(staffRewardTransactionsTable.createdAt)),
  ]);
  const emailById = new Map(staffUsers.map((staff) => [staff.id, staff.email]));
  const approvedTransactions = transactions.filter(
    (transaction) => transaction.status === "approved",
  );

  res.json({
    items: staffUsers.map((staff) => {
      const staffTransactions = transactions.filter(
        (transaction) => transaction.staffUserId === staff.id,
      );
      const approved = approvedTransactions.filter(
        (transaction) => transaction.staffUserId === staff.id,
      );
      return {
        staffUserId: staff.id,
        staffEmail: staff.email,
        pointsBalance: approved.reduce(
          (total, transaction) => total + transaction.pointsDelta,
          0,
        ),
        cashBalance: approved.reduce(
          (total, transaction) => total + Number(transaction.cashAmount),
          0,
        ),
        holidayBalance: approved
          .filter((transaction) => transaction.kind === "holiday_package")
          .reduce((total, transaction) => total + Number(transaction.cashAmount), 0),
        internationalTravelBalance: approved
          .filter((transaction) => transaction.kind === "international_trip")
          .reduce((total, transaction) => total + Number(transaction.cashAmount), 0),
        plans: plans
          .filter((plan) => plan.staffUserId === staff.id)
          .map((plan) => serializePlan(plan, emailById.get(staff.id) ?? staff.email)),
        transactions: staffTransactions.map((transaction) =>
          serializeTransaction(transaction, staff.email),
        ),
      };
    }),
  });
});

router.post("/staff/rewards/plans", async (req, res): Promise<void> => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;
  if (authorization.staff.role !== "admin") {
    res.status(403).json({ error: "Ödül paketi yalnızca yönetici tarafından tanımlanabilir." });
    return;
  }
  const parsed = CreateStaffRewardPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ödül paketi bilgileri geçersiz." });
    return;
  }
  const input = parsed.data;
  const [staff] = await db
    .select()
    .from(staffUsersTable)
    .where(
      and(eq(staffUsersTable.email, input.staffEmail.trim().toLowerCase()), eq(staffUsersTable.active, 1)),
    )
    .limit(1);
  if (!staff) {
    res.status(404).json({ error: "Aktif personel bulunamadı." });
    return;
  }
  const [plan] = await db
    .insert(staffRewardPlansTable)
    .values({
      staffUserId: staff.id,
      name: input.name.trim(),
      monthlyPoints: input.monthlyPoints ?? 0,
      monthlyCashAmount: String(input.monthlyCashAmount ?? 0),
      currency: input.currency ?? "TRY",
      holidayPackageBudget: String(input.holidayPackageBudget ?? 0),
      internationalTravelBudget: String(input.internationalTravelBudget ?? 0),
      customBenefits: input.customBenefits ?? [],
      createdByClerkUserId: authorization.userId,
    })
    .returning();
  res.status(201).json(serializePlan(plan, staff.email));
});

router.post("/staff/rewards/transactions", async (req, res): Promise<void> => {
  const authorization = await requireStaff(req, res);
  if (!authorization) return;
  if (authorization.staff.role !== "admin") {
    res.status(403).json({ error: "Ödül kazanımı yalnızca yönetici tarafından tanımlanabilir." });
    return;
  }
  const parsed = CreateStaffRewardTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ödül kazanımı bilgileri geçersiz." });
    return;
  }
  const input = parsed.data;
  const [staff] = await db
    .select()
    .from(staffUsersTable)
    .where(
      and(eq(staffUsersTable.email, input.staffEmail.trim().toLowerCase()), eq(staffUsersTable.active, 1)),
    )
    .limit(1);
  if (!staff) {
    res.status(404).json({ error: "Aktif personel bulunamadı." });
    return;
  }
  const [plan] = await db
    .select({ id: staffRewardPlansTable.id })
    .from(staffRewardPlansTable)
    .where(
      and(
        eq(staffRewardPlansTable.staffUserId, staff.id),
        eq(staffRewardPlansTable.status, "active"),
      ),
    )
    .orderBy(desc(staffRewardPlansTable.createdAt))
    .limit(1);
  const [transaction] = await db
    .insert(staffRewardTransactionsTable)
    .values({
      staffUserId: staff.id,
      planId: plan?.id ?? null,
      kind: input.kind,
      pointsDelta: input.pointsDelta ?? 0,
      cashAmount: String(input.cashAmount ?? 0),
      currency: input.currency ?? "TRY",
      title: input.title.trim(),
      reason: input.reason?.trim() ?? "",
      status: input.kind === "points" ? "approved" : "pending_approval",
      createdByClerkUserId: authorization.userId,
      ...(input.kind === "points"
        ? {
            approvedByClerkUserId: authorization.userId,
            approvedAt: new Date(),
          }
        : {}),
    })
    .returning();
  res.status(201).json(serializeTransaction(transaction, staff.email));
});

router.patch(
  "/staff/rewards/transactions/:id/decision",
  async (req, res): Promise<void> => {
    const authorization = await requireStaff(req, res);
    if (!authorization) return;
    if (authorization.staff.role !== "admin") {
      res.status(403).json({ error: "Ödül kararı yalnızca yönetici tarafından verilebilir." });
      return;
    }
    const params = DecideStaffRewardTransactionParams.safeParse(req.params);
    const parsed = DecideStaffRewardTransactionBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Ödül kararı geçersiz." });
      return;
    }
    const [existing] = await db
      .select()
      .from(staffRewardTransactionsTable)
      .where(
        and(
          eq(staffRewardTransactionsTable.id, params.data.id),
          eq(staffRewardTransactionsTable.status, "pending_approval"),
        ),
      )
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Bekleyen ödül kaydı bulunamadı." });
      return;
    }
    const [updated] = await db
      .update(staffRewardTransactionsTable)
      .set({
        status: parsed.data.decision === "approve" ? "approved" : "rejected",
        approvedByClerkUserId: authorization.userId,
        approvedAt: new Date(),
      })
      .where(eq(staffRewardTransactionsTable.id, existing.id))
      .returning();
    const [staff] = await db
      .select({ email: staffUsersTable.email })
      .from(staffUsersTable)
      .where(eq(staffUsersTable.id, updated.staffUserId))
      .limit(1);
    res.json(serializeTransaction(updated, staff?.email ?? ""));
  },
);

export default router;