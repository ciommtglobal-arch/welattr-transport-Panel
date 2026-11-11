import { and, eq } from "drizzle-orm";
import { db, b2bBusinessProfilesTable, b2bCompanyMembersTable } from "@workspace/db";
import { type Request, type Response } from "express";
import { requireUser } from "./staffAuth";

export type CompanyMemberRole = "owner" | "admin" | "manager" | "member";

export async function requireCompanyAccess(
  req: Request,
  res: Response,
  businessProfileId: number,
  allowedRoles?: CompanyMemberRole[],
) {
  const userId = requireUser(req, res);
  if (!userId) return null;

  const [profile] = await db
    .select()
    .from(b2bBusinessProfilesTable)
    .where(eq(b2bBusinessProfilesTable.id, businessProfileId))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "İşletme profili bulunamadı." });
    return null;
  }

  let [member] = await db
    .select()
    .from(b2bCompanyMembersTable)
    .where(
      and(
        eq(b2bCompanyMembersTable.businessProfileId, businessProfileId),
        eq(b2bCompanyMembersTable.clerkUserId, userId),
      ),
    )
    .limit(1);

  if (!member && profile.ownerClerkUserId === userId) {
    const [createdOwner] = await db
      .insert(b2bCompanyMembersTable)
      .values({
        businessProfileId,
        clerkUserId: userId,
        fullName: profile.contactName ?? profile.publicName,
        email: profile.email ?? profile.contact,
        phone: profile.phone,
        role: "owner",
        status: "active",
        areas: ["operations", "logistics", "sales", "finance", "customer_relations"],
        acceptedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [
          b2bCompanyMembersTable.businessProfileId,
          b2bCompanyMembersTable.email,
        ],
      })
      .returning();
    member = createdOwner;
  }

  if (!member) {
    res.status(403).json({ error: "Bu firma için aktif yetkiniz bulunmuyor." });
    return null;
  }

  // Existing revoked/invited memberships must never be silently reactivated,
  // including the firm's owner. Lazy owner creation is only for no membership.
  if (member.status !== "active") {
    res.status(403).json({ error: "Bu firma için aktif yetkiniz bulunmuyor." });
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(member.role)) {
    res.status(403).json({ error: "Bu işlem için firma yetkiniz bulunmuyor." });
    return null;
  }

  return { userId, profile, member };
}

export async function requireMyCompany(
  req: Request,
  res: Response,
  allowedRoles?: CompanyMemberRole[],
) {
  const userId = requireUser(req, res);
  if (!userId) return null;

  const [ownedProfile] = await db
    .select({ id: b2bBusinessProfilesTable.id })
    .from(b2bBusinessProfilesTable)
    .where(eq(b2bBusinessProfilesTable.ownerClerkUserId, userId))
    .limit(1);

  const [membership] = await db
    .select({ businessProfileId: b2bCompanyMembersTable.businessProfileId })
    .from(b2bCompanyMembersTable)
    .where(
      and(
        eq(b2bCompanyMembersTable.clerkUserId, userId),
        eq(b2bCompanyMembersTable.status, "active"),
      ),
    )
    .limit(1);

  const profileId = ownedProfile?.id ?? membership?.businessProfileId;
  if (!profileId) {
    res.status(404).json({ error: "Bu hesapla bağlı bir firma bulunamadı." });
    return null;
  }

  return requireCompanyAccess(req, res, profileId, allowedRoles);
}