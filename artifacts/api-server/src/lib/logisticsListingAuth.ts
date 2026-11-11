import { and, eq } from "drizzle-orm";
import { db, logisticsListingGrantsTable, staffUsersTable } from "@workspace/db";
import type { Request, Response } from "express";
import { requireUser } from "./staffAuth";

export function isLogisticsFounder(userId: string) {
  const founder = process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID?.trim();
  return Boolean(founder && founder === userId);
}

export function isMissingLogisticsSchema(error: unknown) {
  const value = error as { code?: string; cause?: { code?: string } } | null;
  return value?.code === "42P01" || value?.cause?.code === "42P01";
}

export async function findLogisticsGrant(userId: string) {
  try {
    const [grant] = await db.select().from(logisticsListingGrantsTable)
      .where(and(eq(logisticsListingGrantsTable.clerkUserId, userId), eq(logisticsListingGrantsTable.active, 1))).limit(1);
    return grant ?? null;
  } catch (error) {
    // Old deployments have no grants at all; do not break their staff login.
    // The new workspace itself reports missing schema explicitly.
    if (isMissingLogisticsSchema(error)) return null;
    throw error;
  }
}

export async function requireLogisticsAccess(req: Request, res: Response) {
  const userId = requireUser(req, res);
  if (!userId) return null;
  const [staff] = await db.select().from(staffUsersTable)
    .where(and(eq(staffUsersTable.clerkUserId, userId), eq(staffUsersTable.active, 1))).limit(1);
  const [grant] = await db.select().from(logisticsListingGrantsTable)
    .where(and(eq(logisticsListingGrantsTable.clerkUserId, userId), eq(logisticsListingGrantsTable.active, 1))).limit(1);
  const canPublish = isLogisticsFounder(userId);
  const canManageGrants = canPublish || staff?.role === "admin";
  if (!grant && !canManageGrants) {
    res.status(403).json({ error: "Lojistik ilanları yetkiniz bulunmuyor." });
    return null;
  }
  return { userId, canDraft: Boolean(grant), canManageGrants, canPublish };
}
