import { Router, type IRouter } from "express";
import {
  db,
  staffProfilesTable,
  type StaffProfile,
} from "@workspace/db";
import { asc } from "drizzle-orm";
import { requireStaff } from "../lib/staffAuth";

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

export default router;