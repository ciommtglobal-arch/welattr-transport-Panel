import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, logisticsPilotFilesTable as files, logisticsPilotInvitesTable as invites,
  logisticsPilotTasksTable as tasks, logisticsPilotSubmissionsTable as submissions,
  logisticsPilotEventsTable as events, type LogisticsPilotFile } from "@workspace/db";
import { MutateLogisticsPilotWorkspaceBody } from "@workspace/api-zod";
import { LOGISTICS_TEST_PILOT as reference } from "./logisticsPilotReadiness";
import type { LogisticsActor } from "./logisticsWorkflowAuth";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Input = typeof MutateLogisticsPilotWorkspaceBody._output;
export class PilotError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const fail = (status: number, message: string): never => { throw new PilotError(status, message); };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const pilotEnvironmentEnabled = () =>
  ["development", "test"].includes(process.env.NODE_ENV ?? "") && !process.env.REPLIT_DEPLOYMENT;

export function assertInviteUsable(invite: {
  targetUserId: string; acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date;
} | undefined, userId: string, now = new Date()) {
  if (!invite || invite.targetUserId !== userId || invite.acceptedAt || invite.revokedAt ||
      invite.expiresAt.getTime() <= now.getTime()) {
    fail(409, "Davet geçersiz, süresi dolmuş, iptal edilmiş, kullanılmış veya başka kullanıcıya ait.");
  }
}

export function assertTaskTransition(
  status: string, action: string, assignee: string, actor: string, canReview: boolean,
) {
  if (action === "submit_task") {
    if (assignee !== actor) fail(403, "Yalnız görev sorumlusu çıktı teslim edebilir.");
    if (!["assigned", "revision_requested"].includes(status)) fail(409, "Bu görev yeniden teslim edilemez.");
  } else {
    if (!canReview || assignee === actor) fail(403, "Kendi çıktınıza veya yetkisiz bir göreve karar veremezsiniz.");
    if (status !== "submitted") fail(409, "Önce görev çıktısı teslim edilmeli.");
  }
}

async function roleFor(tx: Tx, file: LogisticsPilotFile, actor: LogisticsActor) {
  if (actor.isFounder || file.ownerUserId === actor.userId) return "owner" as const;
  const memberships = await tx.select({ role: invites.role }).from(invites).where(and(
    eq(invites.reference, reference), eq(invites.targetUserId, actor.userId),
    isNotNull(invites.acceptedAt), isNull(invites.revokedAt),
  ));
  if (memberships.some(m => m.role === "reviewer")) return "reviewer" as const;
  if (memberships.some(m => m.role === "worker")) return "worker" as const;
  return fail(403, "Bu TEST dosyası için erişim yetkiniz yok.");
}

async function readWorkspace(tx: Tx, actor: LogisticsActor, file: LogisticsPilotFile | undefined) {
  const role = file ? await roleFor(tx, file, actor) : "none";
  const taskRows = file ? await tx.select().from(tasks).where(eq(tasks.reference, reference)).orderBy(asc(tasks.createdAt)) : [];
  const outputs = taskRows.length ? await tx.select().from(submissions)
    .where(inArray(submissions.taskId, taskRows.map(t => t.id))).orderBy(asc(submissions.revision)) : [];
  const inviteRows = file && role === "owner" ? await tx.select({
    id: invites.id, targetUserId: invites.targetUserId, role: invites.role,
    expiresAt: invites.expiresAt, acceptedAt: invites.acceptedAt, revokedAt: invites.revokedAt,
  }).from(invites).where(eq(invites.reference, reference)).orderBy(asc(invites.createdAt)) : [];
  const history = file ? await tx.select().from(events).where(eq(events.reference, reference)).orderBy(asc(events.createdAt), asc(events.id)) : [];
  return {
    reference, isTest: true, commercialApproval: false, actorUserId: actor.userId, isFounder: actor.isFounder,
    role, file: file ?? null, invitations: inviteRows,
    tasks: taskRows.map(t => ({ ...t, submissions: outputs.filter(s => s.taskId === t.id) })),
    history,
    summary: {
      missing: taskRows.filter(t => ["assigned", "revision_requested"].includes(t.status)).length,
      overdue: taskRows.filter(t => t.status !== "accepted" && t.dueAt < new Date()).length,
      awaitingDecision: taskRows.filter(t => t.status === "submitted").length + (file?.reviewState === "review_requested" ? 1 : 0),
    },
  };
}

// The file row is the aggregate lock: every mutation, invitation acceptance, output
// revision and its human audit entry commit together. No update touches real logistics.
export async function getPilotWorkspace(actor: LogisticsActor, canInitialize: boolean) {
  return db.transaction(async tx => {
    const [file] = await tx.select().from(files).where(eq(files.reference, reference)).for("share");
    if (!file && !canInitialize) fail(403, "Davetinizi kabul edin veya operasyon yetkisiyle giriş yapın.");
    return readWorkspace(tx, actor, file);
  });
}

const required = (value: string | undefined, label: string) => {
  if (!value?.trim()) fail(400, `${label} zorunlu.`);
  return value!.trim();
};

async function verifyTestRecipient(userId: string) {
  let user;
  try { user = await clerkClient.users.getUser(userId); }
  catch { fail(400, "Davet alıcısı mevcut bir Clerk TEST hesabı olmalı."); }
  const testingEmail = user!.emailAddresses.some(e =>
    /^[^@\s]+\+clerk_test[^@\s]*@example\.com$/i.test(e.emailAddress));
  if (user!.privateMetadata.logisticsPilotTest !== true && !testingEmail) {
    fail(400, "Yalnız logisticsPilotTest işaretli veya Clerk testing e-postalı TEST hesabı davet edilebilir.");
  }
}

export async function mutatePilotWorkspace(actor: LogisticsActor, input: Input, canInitialize: boolean) {
  return db.transaction(async tx => {
    if (input.action === "create_file") {
      if (!canInitialize) fail(403, "TEST dosyasını yalnız mevcut operasyon yetkilisi veya kurucu açabilir.");
      const inserted = await tx.insert(files).values({ reference, ownerUserId: actor.userId })
        .onConflictDoNothing().returning();
      if (!inserted.length) fail(409, "TEST dosyası zaten mevcut; tekrar oluşturulmadı.");
    }
    let [file] = await tx.select().from(files).where(eq(files.reference, reference)).for("update");
    if (!file) fail(404, "TEST dosyası henüz oluşturulmadı.");
    let inviteToken: string | undefined;
    let detail = "TEST dosyası oluşturuldu; gerçek sevkiyat veya ticari onay değildir.";
    if (input.action === "accept_invite") {
      const token = required(input.token, "Davet anahtarı");
      const [invite] = await tx.select().from(invites).where(and(
        eq(invites.reference, reference), eq(invites.tokenHash, hash(token)),
      ));
      assertInviteUsable(invite, actor.userId);
      await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite.id));
      detail = `TEST dosyası daveti kabul edildi; dosya rolü: ${invite.role}.`;
    }
    const role = await roleFor(tx, file, actor);
    const owner = role === "owner";
    const canReview = owner || role === "reviewer";
    if (["invite", "revoke_invite", "create_task", "request_review"].includes(input.action) && !owner) {
      fail(403, "Bu işlem TEST dosyası sorumlusuna aittir.");
    }
    const contentAction = ["create_task", "submit_task", "request_revision", "accept_task"].includes(input.action);
    if (contentAction && ["review_requested", "approved_test"].includes(file.reviewState)) {
      fail(409, "Karara gönderilmiş veya TEST değerlendirmesi bitmiş dosyada görev değiştirilemez.");
    }
    if (input.action === "invite") {
      // Authorize first, then check the provider. Arbitrary signed-in users
      // cannot use this endpoint to probe the Clerk user directory.
      await verifyTestRecipient(required(input.targetUserId, "TEST kullanıcı kimliği"));
      const previous = await tx.select().from(invites).where(and(
        eq(invites.reference, reference), eq(invites.targetUserId, input.targetUserId!),
        isNull(invites.revokedAt),
      ));
      if (previous.some(i => i.acceptedAt || i.expiresAt > new Date())) {
        fail(409, "Bu TEST kullanıcısının etkin daveti veya dosya üyeliği zaten var.");
      }
      const expiresAt = input.expiresAt;
      if (!expiresAt || expiresAt <= new Date() || expiresAt.getTime() > Date.now() + 30 * 86400000) {
        fail(400, "Davet süresi gelecekte ve en fazla 30 gün olmalı.");
      }
      if (!input.role) fail(400, "Davet rolü zorunlu.");
      inviteToken = randomBytes(32).toString("hex");
      await tx.insert(invites).values({
        reference, targetUserId: input.targetUserId!, role: input.role!,
        tokenHash: hash(inviteToken), expiresAt: expiresAt!,
      });
      detail = `TEST daveti oluşturuldu; alıcı: ${input.targetUserId}, rol: ${input.role}.`;
    } else if (input.action === "revoke_invite") {
      const id = required(input.inviteId, "Davet kimliği");
      const changed = await tx.update(invites).set({ revokedAt: new Date() }).where(and(
        eq(invites.id, id), eq(invites.reference, reference), isNull(invites.revokedAt),
      )).returning();
      if (!changed.length) fail(409, "Davet bulunamadı veya zaten iptal edilmiş.");
      detail = `TEST daveti ve bağlı dosya erişimi iptal edildi: ${id}.`;
    } else if (input.action === "create_task") {
      const assignedTo = required(input.assignedTo, "Görev sorumlusu");
      const title = required(input.title, "Görev başlığı");
      if (!input.dueAt || !Number.isFinite(input.dueAt.getTime())) fail(400, "Geçerli teslim tarihi zorunlu.");
      if (assignedTo !== file.ownerUserId && !(owner && assignedTo === actor.userId)) {
        const [member] = await tx.select().from(invites).where(and(
          eq(invites.reference, reference), eq(invites.targetUserId, assignedTo), eq(invites.role, "worker"),
          isNotNull(invites.acceptedAt), isNull(invites.revokedAt),
        )).limit(1);
        if (!member) fail(400, "Görev sorumlusu bu dosyanın kabul edilmiş TEST çalışanı olmalı.");
      }
      const [task] = await tx.insert(tasks).values({ reference, title, assignedTo, dueAt: input.dueAt! }).returning();
      detail = `TEST görevi oluşturuldu: ${task.id}; sorumlu: ${assignedTo}; teslim: ${input.dueAt!.toISOString()}.`;
    } else if (["submit_task", "request_revision", "accept_task"].includes(input.action)) {
      const id = required(input.taskId, "Görev kimliği");
      const [task] = await tx.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.reference, reference)));
      if (!task) fail(404, "Bu dosyada görev bulunamadı.");
      assertTaskTransition(task.status, input.action, task.assignedTo, actor.userId, canReview);
      if (input.action === "submit_task") {
        const content = required(input.content, "Görev çıktısı");
        const previous = await tx.select().from(submissions).where(eq(submissions.taskId, task.id));
        await tx.insert(submissions).values({ taskId: task.id, revision: previous.length + 1, content, createdBy: actor.userId });
        await tx.update(tasks).set({ status: "submitted" }).where(eq(tasks.id, task.id));
        detail = `TEST çıktısı teslim edildi: ${task.id}; sürüm: ${previous.length + 1}. Önceki çıktılar korundu.`;
      } else {
        const note = input.action === "request_revision" ? required(input.note, "Düzeltme gerekçesi") : null;
        await tx.update(tasks).set({
          status: input.action === "accept_task" ? "accepted" : "revision_requested",
          revisionNote: note,
        }).where(eq(tasks.id, task.id));
        detail = `TEST görevi ${input.action === "accept_task" ? "kabul edildi" : "düzeltmeye gönderildi"}: ${task.id}.${note ? ` Gerekçe: ${note}` : ""}`;
      }
    } else if (input.action === "request_review") {
      if (!["draft", "changes_requested"].includes(file.reviewState)) fail(409, "Dosya bu durumda karara gönderilemez.");
      const rows = await tx.select().from(tasks).where(eq(tasks.reference, reference));
      if (!rows.length || rows.some(t => t.status !== "accepted")) fail(409, "En az bir görev ve tüm çıktılar için bağımsız kabul gerekiyor.");
      [file] = await tx.update(files).set({ reviewState: "review_requested", decisionNote: null }).where(eq(files.reference, reference)).returning();
      detail = "TEST dosyası kurucu TEST değerlendirmesine gönderildi; ticari onay istenmedi.";
    } else if (input.action === "decide_review") {
      if (!actor.isFounder) fail(403, "Son TEST kararı yalnız mevcut kurucu kimliğine aittir.");
      if (file.reviewState !== "review_requested" || !input.decision) fail(409, "Önce TEST dosyası incelemeye gönderilmeli.");
      const note = required(input.note, "Karar gerekçesi");
      [file] = await tx.update(files).set({ reviewState: input.decision!, decisionNote: note }).where(eq(files.reference, reference)).returning();
      detail = `Kurucu TEST kararı: ${input.decision}. ${note} Ticari onay/yayın/sevkiyat oluşturulmadı.`;
    }
    await tx.insert(events).values({ reference, actorUserId: actor.userId, action: input.action, detail });
    return { ...await readWorkspace(tx, actor, file), ...(inviteToken ? { inviteToken } : {}) };
  });
}
