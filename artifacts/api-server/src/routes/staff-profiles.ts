import { Router, type IRouter } from "express";
import {
  db,
  staffProfilesTable,
  type StaffProfile,
} from "@workspace/db";
import { asc } from "drizzle-orm";
import { requireOperationsStaff, requireStaff } from "../lib/staffAuth";

const router: IRouter = Router();

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