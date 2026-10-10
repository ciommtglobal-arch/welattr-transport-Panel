import { Router, type IRouter } from "express";
import {
  db,
  staffProfilesTable,
  staffUsersTable,
  type StaffProfile,
} from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import { requireOperationsStaff, requireStaff, requireUser } from "../lib/staffAuth";
import { findLogisticsGrant } from "../lib/logisticsListingAuth";

const router: IRouter = Router();

router.get("/staff/access", async (req, res): Promise<void> => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const founderId = process.env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID?.trim();
  if (founderId && userId === founderId) {
    res.json({ role: "founder", workspace: "/staff/yonetim-paneli" });
    return;
  }
  const grant = await findLogisticsGrant(userId);
  if (grant) {
    const [existingStaff] = await db.select().from(staffUsersTable)
      .where(and(eq(staffUsersTable.clerkUserId, userId), eq(staffUsersTable.active, 1))).limit(1);
    if (!existingStaff) {
      res.json({ role: "logistics_listings", workspace: "/staff/lojistik-ilanlari" });
      return;
    }
  }
  const authorization = await requireStaff(req, res);
  if (!authorization) return;
  const workspaces = {
    admin: "/staff/calisma-alani",
    operations: "/staff/calisma-alani",
    finance: "/staff/calisma-alani",
    reviewer: "/staff/calisma-alani",
  } as const;
  res.json({
    role: authorization.staff.role,
    workspace: workspaces[authorization.staff.role],
  });
});

function serializeProfile(profile: StaffProfile) {
  return {
    id: profile.id,
    internalId: profile.internalId,
    fullName: profile.fullName,
    contactEmail: profile.contactEmail,
    proposedRole: profile.proposedRole,
    profileStatus: profile.profileStatus,
    languages: profile.languages,
    educationSummary: profile.educationSummary,
    businessSummary: profile.businessSummary,
    additionalResponsibility: profile.additionalResponsibility,
    approvalRequired: profile.approvalRequired,
    supportRequested: profile.supportRequested,
    supportNote: profile.supportNote,
    publicVisibility: profile.publicVisibility,
    verificationNote: profile.verificationNote,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

router.get("/staff/profiles", async (req, res): Promise<void> => {
  if (!(await requireStaff(req, res))) return;

  const profiles = await db
    .select()
    .from(staffProfilesTable)
    .orderBy(asc(staffProfilesTable.createdAt));

  res.json(profiles.map(serializeProfile));
});

router.get("/staff/operations-desk", async (req, res): Promise<void> => {
  const authorization = await requireOperationsStaff(req, res);
  if (!authorization) return;

  res.json({
    deskCode: "MMT-OPS-DESK-001",
    deskTitle: "Genel Operasyon ve Koordinasyon Masası",
    assignedTo: "Abdurrahman Bey",
    role: authorization.staff.role,
    accountEmail: authorization.staff.email,
    responsibilities: [
      "Lojistik ve saha operasyonlarını günlük olarak takip etmek",
      "Ekiplerden durum, risk ve sonraki adım bilgilerini toplamak",
      "Açık iş dosyalarını ilgili sorumlulara yönlendirmek",
      "Kritik konuları proje sahibine zamanında bildirmek",
    ],
    boundaries: [
      "Finansal onay ve para transferi yetkisi yoktur",
      "Şirket adına sözleşme veya kesin ticari taahhüt veremez",
      "Teklif onayı yalnızca yönetici onayıyla tamamlanır",
    ],
  });
});

export default router;