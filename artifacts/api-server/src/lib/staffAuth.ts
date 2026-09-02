import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, staffUsersTable } from "@workspace/db";
import { type Request, type Response } from "express";

export async function requireStaff(req: Request, res: Response) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Oturum açmanız gerekiyor." });
    return null;
  }

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
