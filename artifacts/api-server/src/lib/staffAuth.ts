import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, staffUsersTable } from "@workspace/db";
import { type Request, type Response } from "express";

export function requireUser(req: Request, res: Response) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Oturum açmanız gerekiyor." });
    return null;
  }

  return userId;
}

export async function requireStaff(req: Request, res: Response) {
  const userId = requireUser(req, res);
  if (!userId) return null;

  const [staff] = await db
    .select()
    .from(staffUsersTable)
    .where(
      and(
        eq(staffUsersTable.clerkUserId, userId),
        eq(staffUsersTable.active, 1),
      ),
    )
    .limit(1);

  if (!staff) {
    res.status(403).json({ error: "Bu alan için personel yetkisi gerekiyor." });
    return null;
  }

  return { staff, userId };
}

export async function requireB2BReviewer(req: Request, res: Response) {
  const userId = requireUser(req, res);
  if (!userId) return null;

  const [staff] = await db
    .select()
    .from(staffUsersTable)
    .where(
      and(
        eq(staffUsersTable.clerkUserId, userId),
        eq(staffUsersTable.active, 1),
      ),
    )
    .limit(1);

  if (staff) {
    return { staff, userId, founderReviewer: false as const };
  }

  if (
    process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID?.trim() === userId
  ) {
    return { staff: null, userId, founderReviewer: true as const };
  }

  res.status(403).json({ error: "Bu alan için personel yetkisi gerekiyor." });
  return null;
}

export async function requireOperationsStaff(req: Request, res: Response) {
  const authorization = await requireStaff(req, res);
  if (!authorization) return null;

  if (
    authorization.staff.role !== "operations" &&
    authorization.staff.role !== "admin"
  ) {
    res.status(403).json({
      error: "Bu masa için operasyon veya yönetici yetkisi gerekiyor.",
    });
    return null;
  }

  return authorization;
}

export async function requireFinanceStaff(req: Request, res: Response) {
  const authorization = await requireStaff(req, res);
  if (!authorization) return null;

  if (
    authorization.staff.role !== "finance" &&
    authorization.staff.role !== "admin"
  ) {
    res.status(403).json({
      error: "Bu finans ekranı için finans veya yönetici yetkisi gerekiyor.",
    });
    return null;
  }

  return authorization;
}
