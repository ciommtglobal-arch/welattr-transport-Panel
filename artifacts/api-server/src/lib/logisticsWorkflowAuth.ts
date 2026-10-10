import type { Request, Response } from "express";
import { requireStaff, requireUser } from "./staffAuth";
import { isLogisticsFounder } from "./logisticsListingAuth";

export type LogisticsActor = { userId: string; isFounder: boolean };

// Add the existing founder identity without changing any accounts or staff grants.
export async function requireLogisticsOperator(req: Request, res: Response): Promise<LogisticsActor | null> {
  const userId = requireUser(req, res);
  if (!userId) return null;
  if (isLogisticsFounder(userId)) return { userId, isFounder: true };
  const staff = await requireStaff(req, res);
  if (!staff) return null;
  // An active staff account or administrative title is not an operations grant.
  if (staff.staff.role !== "operations") {
    res.status(403).json({ error: "Bu lojistik masa için operasyon yetkisi gerekiyor." });
    return null;
  }
  return { userId: staff.userId, isFounder: false };
}

export function requireLogisticsFounder(req: Request, res: Response): LogisticsActor | null {
  const userId = requireUser(req, res);
  if (!userId) return null;
  if (!isLogisticsFounder(userId)) {
    res.status(403).json({ error: "Son karar yalnız kurucuya aittir; yönetici rolü yeterli değildir." });
    return null;
  }
  return { userId, isFounder: true };
}
