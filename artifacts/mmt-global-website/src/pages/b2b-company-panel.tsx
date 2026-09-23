import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import {
  ArrowLeft,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clipboard,
  Copy,
  Clock3,
  Inbox,
  LayoutDashboard,
  Loader2,
  Mail,
  MessageSquareText,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  acceptB2BCompanyInvitation,
  createB2BCompanyRequest,
  createB2BCompanyTask,
  getGetMyB2BCompanyMembersQueryKey,
  getGetMyB2BCompanyRequestsQueryKey,
  getGetMyB2BCompanyTasksQueryKey,
  getGetMyB2BBusinessProfileQueryKey,
  inviteB2BCompanyMember,
  updateB2BCompanyRequest,
  updateB2BCompanyTask,
  useGetMyB2BCompanyMembers,
  useGetMyB2BCompanyRequests,
  useGetMyB2BCompanyTasks,
  useGetMyB2BBusinessProfile,
  getGetB2BWorkflowApprovalsQueryKey,
  getGetWorkflowNotificationsQueryKey,
  useDecideB2BWorkflowApproval,
  useGetB2BWorkflowApprovals,
  useGetWorkflowNotifications,
  useMarkWorkflowNotificationRead,
  useReviewB2BWorkflowApproval,
  type B2BBusinessProfile,
  type B2BCompanyMember,
  type B2BCompanyMemberRole,
  type B2BCompanyRequest,
  type B2BCompanyRequestPriority,
  type B2BCompanyRequestStatus,
  type B2BCompanyTaskStatus,
  type WorkflowApproval,
  type WorkflowApprovalStatus,
  type WorkflowNotification,
} from "@workspace/api-client-react";

const taskStatuses: Array<[B2BCompanyTaskStatus, string]> = [
  ["pending", "Bekliyor"],
  ["in_progress", "Devam Ediyor"],
  ["completed", "Tamamlandı"],
];

const requestStatuses: Array<[B2BCompanyRequestStatus, string]> = [
  ["pending", "Bekliyor"],
  ["in_progress", "İnceleniyor"],
  ["resolved", "Çözüldü"],
  ["rejected", "Uygun değil"],
];

const defaultAreas = [
  "operasyon",
  "lojistik",
  "satış",
  "finans",
  "müşteri ilişkileri",
];

const roleLabels: Record<B2BCompanyMemberRole, string> = {
  owner: "Firma sahibi",
  admin: "Firma yöneticisi",
  manager: "Alan yöneticisi",
  member: "Personel",
};

const areaLabels: Record<string, string> = {
  operations: "operasyon",
  logistics: "lojistik",
  sales: "satış",
  finance: "finans",
  customer_relations: "müşteri ilişkileri",
};

function formatArea(area: string) {
  return areaLabels[area] ?? area;
}

export default function B2BCompanyPanel() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [inviteToken] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("invite") ??
        window.sessionStorage.getItem("mmt-connect-invite") ??
        "",
  );
  const profileQuery = useGetMyB2BBusinessProfile({
    query: {
      queryKey: getGetMyB2BBusinessProfileQueryKey(),
      retry: false,
      enabled: isLoaded && Boolean(isSignedIn) && !inviteToken,
    },
  });

  if (!isLoaded) return <PanelLoading />;
  if (!isSignedIn) return <PanelSignedOut />;
  if (inviteToken) return <InvitationAcceptance token={inviteToken} />;
  if (profileQuery.isLoading) return <PanelLoading />;
  if (profileQuery.isError || !profileQuery.data) return <NoCompanyState />;

  return (
    <CompanyPanelContent
      profile={profileQuery.data}
      userId={userId}
    />
  );
}

function CompanyPanelContent({
  profile,
  userId,
}: {
  profile: B2BBusinessProfile;
  userId: string | null;
}) {
  const queryClient = useQueryClient();
  const membersQuery = useGetMyB2BCompanyMembers();
  const requestsQuery = useGetMyB2BCompanyRequests();
  const tasksQuery = useGetMyB2BCompanyTasks();
  const approvalsQuery = useGetB2BWorkflowApprovals();
  const notificationsQuery = useGetWorkflowNotifications();
  const [inviteToken, setInviteToken] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("invite") ?? "",
  );
  const members = membersQuery.data?.items ?? [];
  const requests = requestsQuery.data?.items ?? [];
  const tasks = tasksQuery.data?.items ?? [];
  const currentMember = members.find((member) => member.clerkUserId === userId);
  const currentRole: B2BCompanyMemberRole =
    currentMember?.role ?? (members.length === 0 ? "owner" : "member");
  const canManageCompany =
    currentRole === "owner" ||
    currentRole === "admin" ||
    currentRole === "manager";
  const canInviteMembers =
    currentRole === "owner" ||
    currentRole === "admin" ||
    currentRole === "manager";
  const canManage = canManageCompany;
  const canManageTasks = canManageCompany;
  const canReviewApprovals = canManageCompany;
  const canDecideApprovals = currentRole === "owner";
  const [inviteResult, setInviteResult] = useState("");
  const [error, setError] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);

  async function handleAcceptInvite() {
    if (!inviteToken) return;
    setError("");
    setIsAccepting(true);
    try {
      await acceptB2BCompanyInvitation({ token: inviteToken });
      setInviteToken("");
      window.history.replaceState(null, "", window.location.pathname);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetMyB2BCompanyMembersQueryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetMyB2BBusinessProfileQueryKey(),
        }),
      ]);
    } catch (acceptError) {
      const message =
        acceptError instanceof Error
          ? acceptError.message
          : "Davet kabul edilemedi.";
      if (
        message.includes("Davet bulunamadı") ||
        message.includes("daha önce kullanıldı")
      ) {
        window.sessionStorage.removeItem("mmt-connect-invite");
        window.history.replaceState(null, "", window.location.pathname);
        window.location.reload();
        return;
      }
      setError(
        message,
      );
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
          <Link href="/b2b-agi" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-br-2xl rounded-tl-2xl bg-primary text-lg font-bold text-primary-foreground">
              M
            </span>
            <span className="text-sm font-bold tracking-[0.18em]">
              MMT <span className="font-normal text-foreground/55">CONNECT</span>
            </span>
          </Link>
          <Link
            href="/b2b-agi"
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-foreground/55 hover:text-primary"
          >
            <ArrowLeft size={15} />
            B2B ağına dön
          </Link>
        </div>
      </header>

      <section className="border-b border-border/70 bg-secondary px-5 py-12 text-secondary-foreground md:px-10 md:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            <LayoutDashboard size={15} />
            Firma Panelim
          </p>
          <div className="mt-5 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
                {profile.publicName}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-secondary-foreground/65">
                Firma ekibinizi, yetkili alanları ve operasyon görevlerini tek
                panelden yönetin.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 border border-primary/30 bg-primary/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.13em] text-primary">
              <ShieldCheck size={16} />
              {profile.status === "verified"
                ? "Firma doğrulandı"
                : "Doğrulama bekliyor"}
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-8 px-5 py-10 md:px-10 md:py-14">
        {inviteToken ? (
          <div className="flex flex-col justify-between gap-4 border border-primary/30 bg-primary/10 p-5 md:flex-row md:items-center">
            <div>
              <p className="font-semibold">Firma daveti hazır</p>
              <p className="mt-1 text-sm text-foreground/65">
                Bu hesabı ilgili firmaya bağlamak için daveti kabul edin.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAcceptInvite}
              disabled={isAccepting}
              className="inline-flex items-center justify-center gap-2 bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.13em] text-primary-foreground disabled:opacity-60"
            >
              {isAccepting ? <Loader2 size={15} className="animate-spin" /> : null}
              Daveti kabul et
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground/70">
            {error}
          </p>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="border border-border/70 bg-card p-6 md:p-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              Firma özeti
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Kayıt ve yetki durumu</h2>
            <dl className="mt-7 space-y-4 text-sm">
              <SummaryRow label="Firma" value={profile.legalName} />
              <SummaryRow label="Konum" value={[profile.city, profile.country].filter(Boolean).join(" · ")} />
              <SummaryRow label="Yetkili" value={profile.contactName ?? "Henüz belirtilmedi"} />
              <SummaryRow label="Roller" value={profile.roles.join(" · ") || "Henüz seçilmedi"} />
            </dl>
            <div className="mt-7 border-t border-border/70 pt-5 text-xs leading-6 text-foreground/55">
              <p className="font-semibold text-foreground">Güvenlik sınırı</p>
              <p className="mt-1">
                Firma yöneticisi yalnızca bu firmaya bağlı personel ve görevleri
                yönetebilir. Personel bilgileri public ilanlarda gösterilmez.
              </p>
            </div>
          </section>

          <MembersSection
            members={members}
            canManage={canInviteMembers}
            canGrantAdmin={currentRole === "owner"}
            inviteResult={inviteResult}
            setInviteResult={setInviteResult}
            onError={setError}
            onSaved={() =>
              queryClient.invalidateQueries({
                queryKey: getGetMyB2BCompanyMembersQueryKey(),
              })
            }
          />
        </div>

        <WorkflowSection
          approvals={approvalsQuery.data?.items ?? []}
          notifications={notificationsQuery.data?.items ?? []}
          unreadCount={notificationsQuery.data?.unreadCount ?? 0}
          canReview={canReviewApprovals}
          canDecide={canDecideApprovals}
          onError={setError}
          onRefresh={() => {
            void queryClient.invalidateQueries({
              queryKey: getGetB2BWorkflowApprovalsQueryKey(),
            });
            void queryClient.invalidateQueries({
              queryKey: getGetWorkflowNotificationsQueryKey(),
            });
          }}
        />

        <RequestsSection
          requests={requests}
          canSubmit={Boolean(currentMember)}
          canManage={canManage}
          onError={setError}
          onSaved={() =>
            queryClient.invalidateQueries({
              queryKey: getGetMyB2BCompanyRequestsQueryKey(),
            })
          }
        />

        <TasksSection
          tasks={tasks}
          members={members}
          canManage={canManageTasks}
          userMemberId={currentMember?.id}
          onError={setError}
          onSaved={() =>
            queryClient.invalidateQueries({
              queryKey: getGetMyB2BCompanyTasksQueryKey(),
            })
          }
        />
      </section>
    </main>
  );
}

function InvitationAcceptance({ token }: { token: string }) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState('');

  async function handleAccept() {
    setError('');
    setIsAccepting(true);
    try {
      await acceptB2BCompanyInvitation({ token });
      window.sessionStorage.removeItem('mmt-connect-invite');
      window.history.replaceState(null, '', window.location.pathname);
      window.location.reload();
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : 'Davet kabul edilemedi.',
      );
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5">
      <section className="max-w-xl border border-primary/30 bg-card p-8 text-center md:p-12">
        <ShieldCheck className="mx-auto text-primary" size={36} />
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          MMT Connect / Firma Daveti
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Firma ekibine katılın.</h1>
        <p className="mt-4 text-sm leading-7 text-foreground/60">
          Giriş yaptığınız hesap, MMT Global firma ekibine personel olarak
          bağlanacak. Daveti kabul ettiğinizde size tanımlanan operasyon ve
          görev alanları açılacak.
        </p>
        {error ? (
          <p className="mt-5 border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground/70">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleAccept}
          disabled={isAccepting}
          className="mt-7 inline-flex items-center justify-center gap-2 bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground disabled:opacity-60"
        >
          {isAccepting ? <Loader2 size={15} className="animate-spin" /> : null}
          Daveti kabul et
        </button>
      </section>
    </main>
  );
}

function WorkflowSection({
  approvals,
  notifications,
  unreadCount,
  canReview,
  canDecide,
  onError,
  onRefresh,
}: {
  approvals: WorkflowApproval[];
  notifications: WorkflowNotification[];
  unreadCount: number;
  canReview: boolean;
  canDecide: boolean;
  onError: (value: string) => void;
  onRefresh: () => void;
}) {
  const review = useReviewB2BWorkflowApproval({
    mutation: {
      onSuccess: onRefresh,
      onError: () => onError("Onay incelemesi kaydedilemedi."),
    },
  });
  const decide = useDecideB2BWorkflowApproval({
    mutation: {
      onSuccess: onRefresh,
      onError: () => onError("Sahip kararı kaydedilemedi."),
    },
  });
  const markRead = useMarkWorkflowNotificationRead({
    mutation: {
      onSuccess: onRefresh,
      onError: () => onError("Bildirim okunmuş olarak işaretlenemedi."),
    },
  });

  function reviewApproval(approval: WorkflowApproval, decision: "approve" | "reject") {
    review.mutate({
      id: approval.id,
      data: { decision },
    });
  }

  function decideApproval(approval: WorkflowApproval, decision: "approve" | "reject") {
    decide.mutate({
      id: approval.id,
      data: { decision },
    });
  }

  return (
    <section className="border border-primary/25 bg-card p-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            <ShieldCheck size={15} />
            Ortak onay merkezi
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Kontrollü işlem akışı</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/60">
             Her işlem sistem tarafından sınıflandırılır ve firma sahibinin
             onay akışına girer. Finans, hukuk, dışa gönderim, silme ve yetki
             değişikliği içeren işler ayrıca riskli işlem olarak işaretlenir.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 border border-border/70 px-3 py-2 font-mono text-xs">
          <Bell size={14} />
          {unreadCount} yeni bildirim
        </span>
      </div>

      {notifications.length > 0 ? (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {notifications.slice(0, 4).map((notification) => (
            <article
              key={notification.id}
              className={`border p-4 ${
                notification.readAt
                  ? "border-border/60 bg-background/30"
                  : "border-primary/35 bg-primary/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{notification.title}</p>
                  <p className="mt-1 text-xs leading-5 text-foreground/60">
                    {notification.body}
                  </p>
                </div>
                {!notification.readAt ? (
                  <button
                    type="button"
                    onClick={() => markRead.mutate({ id: notification.id })}
                    className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] text-primary"
                  >
                    Okundu
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {approvals.length === 0 ? (
        <p className="mt-6 border border-dashed border-border/70 p-4 text-sm text-foreground/55">
          Bekleyen veya sonuçlanmış ortak onay kaydı bulunmuyor.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              canReview={canReview}
              canDecide={canDecide}
              isBusy={review.isPending || decide.isPending}
              onReview={reviewApproval}
              onDecide={decideApproval}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ApprovalCard({
  approval,
  canReview,
  canDecide,
  isBusy,
  onReview,
  onDecide,
}: {
  approval: WorkflowApproval;
  canReview: boolean;
  canDecide: boolean;
  isBusy: boolean;
  onReview: (approval: WorkflowApproval, decision: "approve" | "reject") => void;
  onDecide: (approval: WorkflowApproval, decision: "approve" | "reject") => void;
}) {
  const riskLabels: Record<WorkflowApproval["riskCategory"], string> = {
    none: "Düşük risk",
    financial: "Finansal risk",
    legal: "Hukuki risk",
    external: "Dışa gönderim / yayın",
    delete: "Silme / geri döndürülemez değişiklik",
    permission: "Yetki değişikliği",
  };
  const statusLabels: Record<WorkflowApprovalStatus, string> = {
    pending_reviewer: "İnceleme bekliyor",
    pending_owner: "Sahip kararı bekliyor",
    auto_approved: "Sistem sürecinde",
    approved: "Onaylandı",
    rejected: "Reddedildi",
    expired: "Süresi geçti",
  };
  const canReviewThis = canReview && approval.status === "pending_reviewer";
  const canDecideThis = canDecide && approval.status === "pending_owner";

  return (
    <article className="border border-border/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-primary">
              {approval.entityType.replaceAll("_", " ")}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                approval.riskCategory === "none"
                  ? "text-emerald-600"
                  : "text-destructive"
              }`}
            >
              {approval.riskCategory === "none" ? (
                <CheckCircle2 size={12} />
              ) : (
                <AlertTriangle size={12} />
              )}
              {riskLabels[approval.riskCategory]}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-semibold">{approval.title}</h3>
        </div>
        <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/50">
          {statusLabels[approval.status]}
        </span>
      </div>
      {approval.summary ? (
        <p className="mt-3 text-sm leading-6 text-foreground/65">
          {approval.summary}
        </p>
      ) : null}
      {approval.riskReason ? (
        <p className="mt-3 border-l-2 border-destructive/40 bg-destructive/5 px-3 py-2 text-xs leading-5 text-foreground/65">
          {approval.riskReason}
        </p>
      ) : null}
      <p className="mt-4 flex items-center gap-2 border-t border-border/70 pt-4 text-xs text-foreground/45">
        <Clock3 size={13} />
        {approval.decisionDueAt
          ? `Karar zamanı: ${new Date(approval.decisionDueAt).toLocaleString("tr-TR")}`
          : "Karar zamanı belirtilmedi"}
      </p>
      {canReviewThis ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onReview(approval, "approve")}
            className="flex-1 bg-primary px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-primary-foreground disabled:opacity-60"
          >
            İncelemeyi onayla
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onReview(approval, "reject")}
            className="border border-destructive/40 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-destructive disabled:opacity-60"
          >
            Reddet
          </button>
        </div>
      ) : null}
      {canDecideThis ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onDecide(approval, "approve")}
            className="flex-1 bg-primary px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-primary-foreground disabled:opacity-60"
          >
            Sahip olarak onayla
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onDecide(approval, "reject")}
            className="border border-destructive/40 px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-destructive disabled:opacity-60"
          >
            Reddet
          </button>
        </div>
      ) : null}
    </article>
  );
}

function MembersSection({
  members,
  canManage,
  canGrantAdmin,
  inviteResult,
  setInviteResult,
  onError,
  onSaved,
}: {
  members: B2BCompanyMember[];
  canManage: boolean;
  canGrantAdmin: boolean;
  inviteResult: string;
  setInviteResult: (value: string) => void;
  onError: (value: string) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    department: "",
    jobTitle: "",
    areas: "operasyon",
    role: "member" as B2BCompanyMemberRole,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");
    setInviteResult("");
    setIsSubmitting(true);
    try {
      const result = await inviteB2BCompanyMember({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        department: form.department.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        areas: form.areas
          .split(",")
          .map((area) => area.trim())
          .filter(Boolean),
        role: form.role === "owner" ? "member" : form.role,
      });
      setInviteResult(result.inviteUrl);
      setForm({
        fullName: "",
        email: "",
        phone: "",
        department: "",
        jobTitle: "",
        areas: "operasyon",
        role: "member",
      });
      onSaved();
    } catch (inviteError) {
      onError(
        inviteError instanceof Error
          ? inviteError.message
          : "Personel daveti gönderilemedi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="border border-border/70 bg-card p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            <Users size={15} />
            Firma personeli
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Ekip ve davetler</h2>
        </div>
        <span className="border border-border/70 px-3 py-2 font-mono text-xs">
          {members.length} kişi
        </span>
      </div>

      <div className="mt-6 space-y-3">
        {members.length === 0 ? (
          <p className="border border-dashed border-border/70 p-4 text-sm text-foreground/55">
            Henüz firma personeli eklenmedi.
          </p>
        ) : (
          members.map((member) => (
            <div key={member.id} className="border border-border/70 p-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                <div>
                  <p className="font-semibold">{member.fullName}</p>
                  <p className="mt-1 break-all text-xs text-foreground/55">
                    {member.email}
                    {member.department ? ` · ${member.department}` : ""}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
                    member.status === "active" ? "text-primary" : "text-foreground/45"
                  }`}
                >
                  {member.status === "active" ? "Aktif" : "Davet bekliyor"}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-foreground/55">
                {roleLabels[member.role]} ·{" "}
                {member.jobTitle ?? "Görev alanı belirtilmedi"} ·{" "}
                {member.areas.map(formatArea).join(", ")}
              </p>
            </div>
          ))
        )}
      </div>

      {canManage ? (
        <form onSubmit={handleSubmit} className="mt-7 border-t border-border/70 pt-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Plus size={16} className="text-primary" />
            Yeni personel davet et
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <PanelField label="Ad soyad *" value={form.fullName} onChange={(value) => setForm((current) => ({ ...current, fullName: value }))} required />
            <PanelField label="E-posta *" type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} required />
            <PanelField label="Telefon" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
            <PanelField label="Departman" value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value }))} />
            <PanelField label="Görev alanı" value={form.jobTitle} onChange={(value) => setForm((current) => ({ ...current, jobTitle: value }))} />
            <PanelField label="Yetkili alanlar (virgülle)" value={form.areas} onChange={(value) => setForm((current) => ({ ...current, areas: value }))} required />
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as B2BCompanyMemberRole }))}
              className="border border-border/70 bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            >
              <option value="member">Personel</option>
              <option value="manager">Alan yöneticisi</option>
               {canGrantAdmin ? (
                 <option value="admin">Firma yöneticisi</option>
               ) : null}
            </select>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex flex-1 items-center justify-center gap-2 bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.13em] text-primary-foreground disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
              Davet bağlantısı oluştur
            </button>
          </div>
        </form>
      ) : null}

      {inviteResult ? (
        <div className="mt-5 border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-semibold">Davet bağlantısı hazır</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={`${window.location.origin}${inviteResult}`} className="min-w-0 flex-1 border border-border/70 bg-background px-3 py-2 text-xs" />
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${inviteResult}`)}
              className="inline-flex items-center justify-center gap-2 border border-primary/40 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-primary"
            >
              <Copy size={14} />
              Kopyala
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-foreground/55">
            Personel bağlantıyı açıp kendi Clerk hesabıyla giriş yaptıktan sonra
            daveti kabul etmelidir. Kabul edilene kadar aktif sayılmaz.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function RequestsSection({
  requests,
  canSubmit,
  canManage,
  onError,
  onSaved,
}: {
  requests: B2BCompanyRequest[];
  canSubmit: boolean;
  canManage: boolean;
  onError: (value: string) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    area: "operasyon",
    priority: "normal" as B2BCompanyRequestPriority,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");
    setIsSubmitting(true);
    try {
      await createB2BCompanyRequest({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        area: form.area.trim(),
        priority: form.priority,
      });
      setForm({
        title: "",
        description: "",
        area: "operasyon",
        priority: "normal",
      });
      onSaved();
    } catch (requestError) {
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Personel talebi gönderilemedi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateStatus(id: number, status: B2BCompanyRequestStatus) {
    onError("");
    setUpdatingId(id);
    try {
      await updateB2BCompanyRequest(id, { status });
      onSaved();
    } catch (requestError) {
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Talep durumu güncellenemedi.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="border border-primary/25 bg-card p-6 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            <Inbox size={15} />
            Firma içi talepler
          </p>
          <h2 className="mt-3 text-2xl font-semibold">
            Personel talepleri size ulaşsın
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/60">
            Personel iş, satın alma, operasyon veya müşteri ilişkileriyle ilgili
            ihtiyacını buradan iletir. Siz ve yetkili yöneticiler talepleri
            görür, durumunu günceller.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 border border-border/70 px-3 py-2 font-mono text-xs">
          <MessageSquareText size={14} />
          {requests.length} talep
        </span>
      </div>

      {requests.length === 0 ? (
        <p className="mt-6 border border-dashed border-border/70 p-4 text-sm text-foreground/55">
          Henüz firma içi talep gönderilmedi.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {requests.map((request) => (
            <article key={request.id} className="border border-border/70 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                        request.priority === "urgent"
                          ? "text-destructive"
                          : "text-primary"
                      }`}
                    >
                      {request.priority === "urgent" ? "Acil" : request.area}
                    </span>
                    {request.priority === "urgent" ? (
                      <span className="text-[10px] text-foreground/45">
                        {request.area}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold">{request.title}</h3>
                  <p className="mt-1 text-xs text-foreground/50">
                    Gönderen: {request.requesterName}
                  </p>
                </div>
                {canManage ? (
                  <select
                    value={request.status}
                    disabled={updatingId === request.id}
                    onChange={(event) =>
                      updateStatus(
                        request.id,
                        event.target.value as B2BCompanyRequestStatus,
                      )
                    }
                    className="h-fit max-w-32 border border-border/70 bg-background px-2 py-2 text-xs outline-none focus:border-primary disabled:opacity-60"
                    aria-label={`${request.title} talep durumu`}
                  >
                    {requestStatuses.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                    {requestStatuses.find(([value]) => value === request.status)?.[1]}
                  </span>
                )}
              </div>
              <p className="mt-4 text-sm leading-6 text-foreground/65">
                {request.description || "Açıklama eklenmedi."}
              </p>
              {request.managerNote ? (
                <div className="mt-4 border-l-2 border-primary/50 bg-primary/5 px-3 py-2 text-xs leading-5 text-foreground/65">
                  <span className="font-semibold text-primary">Yönetici notu: </span>
                  {request.managerNote}
                </div>
              ) : null}
              <p className="mt-5 flex items-center gap-2 border-t border-border/70 pt-4 text-xs text-foreground/45">
                <span>{new Date(request.createdAt).toLocaleDateString("tr-TR")}</span>
                <span>·</span>
                <span>
                  {request.status === "pending"
                    ? "Yanıt bekliyor"
                    : "Firma yöneticisi tarafından takip ediliyor"}
                </span>
              </p>
            </article>
          ))}
        </div>
      )}

      {canSubmit ? (
        <form onSubmit={handleCreate} className="mt-7 border-t border-border/70 pt-6">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Plus size={16} className="text-primary" />
            Yeni talep gönder
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <PanelField
              label="Talep başlığı *"
              value={form.title}
              onChange={(value) =>
                setForm((current) => ({ ...current, title: value }))
              }
              required
            />
            <PanelField
              label="İlgili alan *"
              value={form.area}
              onChange={(value) =>
                setForm((current) => ({ ...current, area: value }))
              }
              required
              list="mmt-request-areas"
            />
            <label className="block text-sm">
              <span className="mb-2 block text-foreground/70">Öncelik</span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as B2BCompanyRequestPriority,
                  }))
                }
                className="w-full border border-border/70 bg-background px-4 py-3 outline-none focus:border-primary"
              >
                <option value="normal">Normal</option>
                <option value="urgent">Acil</option>
              </select>
            </label>
          </div>
          <datalist id="mmt-request-areas">
            {defaultAreas.map((area) => (
              <option key={area} value={area} />
            ))}
          </datalist>
          <label className="mt-4 block text-sm">
            <span className="mb-2 block text-foreground/70">Açıklama</span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={3}
              className="w-full resize-y border border-border/70 bg-background px-4 py-3 outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 inline-flex items-center gap-2 bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.13em] text-primary-foreground disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <MessageSquareText size={15} />
            )}
            Talebi yöneticime gönder
          </button>
        </form>
      ) : null}
    </section>
  );
}

function TasksSection({
  tasks,
  members,
  canManage,
  userMemberId,
  onError,
  onSaved,
}: {
  tasks: Array<{
    id: number;
    title: string;
    description: string;
    area: string;
    dueDate: string | null;
    status: B2BCompanyTaskStatus;
    assigneeMemberId: number | null;
  }>;
  members: B2BCompanyMember[];
  canManage: boolean;
  userMemberId?: number;
  onError: (value: string) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    area: "operasyon",
    dueDate: "",
    assigneeMemberId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "active"),
    [members],
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");
    setIsSubmitting(true);
    try {
      await createB2BCompanyTask({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        area: form.area.trim(),
        dueDate: form.dueDate || null,
        assigneeMemberId: form.assigneeMemberId
          ? Number(form.assigneeMemberId)
          : null,
      });
      setForm({
        title: "",
        description: "",
        area: "operasyon",
        dueDate: "",
        assigneeMemberId: "",
      });
      onSaved();
    } catch (taskError) {
      onError(
        taskError instanceof Error ? taskError.message : "Görev oluşturulamadı.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateStatus(taskId: number, status: B2BCompanyTaskStatus) {
    onError("");
    try {
      await updateB2BCompanyTask(taskId, { status });
      onSaved();
    } catch (taskError) {
      onError(
        taskError instanceof Error ? taskError.message : "Görev güncellenemedi.",
      );
    }
  }

  return (
    <section className="border border-border/70 bg-card p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
            <Clipboard size={15} />
            Firma görevleri
          </p>
          <h2 className="mt-3 text-2xl font-semibold">Alanlara görevlendirme</h2>
        </div>
        <span className="border border-border/70 px-3 py-2 font-mono text-xs">
          {tasks.length} görev
        </span>
      </div>

      {canManage ? (
        <form onSubmit={handleCreate} className="mt-6 border-y border-border/70 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <PanelField label="Görev başlığı *" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} required />
            <PanelField label="İlgili alan *" value={form.area} onChange={(value) => setForm((current) => ({ ...current, area: value }))} required list="mmt-task-areas" />
            <PanelField label="Son tarih" type="date" value={form.dueDate} onChange={(value) => setForm((current) => ({ ...current, dueDate: value }))} />
            <label className="block text-sm">
              <span className="mb-2 block text-foreground/70">Sorumlu personel</span>
              <select
                value={form.assigneeMemberId}
                onChange={(event) => setForm((current) => ({ ...current, assigneeMemberId: event.target.value }))}
                className="w-full border border-border/70 bg-background px-4 py-3 outline-none focus:border-primary"
              >
                <option value="">Atama yapılmadı</option>
                {activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <datalist id="mmt-task-areas">
            {defaultAreas.map((area) => <option key={area} value={area} />)}
          </datalist>
          <label className="mt-4 block text-sm">
            <span className="mb-2 block text-foreground/70">Açıklama</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              className="w-full resize-y border border-border/70 bg-background px-4 py-3 outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 inline-flex items-center gap-2 bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.13em] text-primary-foreground disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Görev oluştur
          </button>
        </form>
      ) : null}

      {tasks.length === 0 ? (
        <div className="py-10 text-sm text-foreground/55">
          Yetkiniz dâhilinde görünen görev bulunmuyor.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {tasks.map((task) => {
            const assignee = members.find((member) => member.id === task.assigneeMemberId);
            const canUpdate = canManage || task.assigneeMemberId === userMemberId;
            return (
              <article key={task.id} className="border border-border/70 p-5">
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                      {task.area}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold">{task.title}</h3>
                  </div>
                  {canUpdate ? (
                    <select
                      value={task.status}
                      onChange={(event) => updateStatus(task.id, event.target.value as B2BCompanyTaskStatus)}
                      className="h-fit border border-border/70 bg-background px-2 py-2 text-xs outline-none focus:border-primary"
                      aria-label={`${task.title} durumu`}
                    >
                      {taskStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  ) : null}
                </div>
                <p className="mt-4 text-sm leading-6 text-foreground/65">
                  {task.description || "Açıklama eklenmedi."}
                </p>
                <div className="mt-5 flex flex-wrap gap-3 border-t border-border/70 pt-4 text-xs text-foreground/50">
                  <span>{assignee ? `Sorumlu: ${assignee.fullName}` : "Sorumlu atanmadı"}</span>
                  <span>{task.dueDate ? `Son tarih: ${task.dueDate}` : "Son tarih yok"}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/50 pb-3 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-foreground/45">{label}</dt>
      <dd className="text-right font-semibold">{value || "Belirtilmedi"}</dd>
    </div>
  );
}

function PanelField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  list,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "date";
  required?: boolean;
  list?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block text-foreground/70">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        list={list}
        className="w-full border border-border/70 bg-background px-4 py-3 outline-none focus:border-primary"
      />
    </label>
  );
}

function PanelLoading() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background">
      <Loader2 className="animate-spin text-primary" size={30} />
    </main>
  );
}

function PanelSignedOut() {
  const inviteToken =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("invite") ?? "";
  const inviteQuery = inviteToken
    ? `?invite=${encodeURIComponent(inviteToken)}`
    : "";

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5">
      <section className="max-w-xl border border-border/70 bg-card p-8 text-center md:p-12">
        <ShieldCheck className="mx-auto text-primary" size={34} />
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          MMT Connect / Firma Panelim
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Firmanızla devam edin.</h1>
        <p className="mt-4 text-sm leading-7 text-foreground/60">
          Firma personeli, davet kabulü ve görev yönetimi için giriş yapın.
        </p>
        <Link
          href={`/sign-in${inviteQuery}`}
          onClick={() => {
            if (inviteToken) {
              window.sessionStorage.setItem("mmt-connect-invite", inviteToken);
            }
          }}
          className="mt-7 inline-flex items-center gap-2 bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground"
        >
          Giriş yap
        </Link>
        {inviteToken ? (
          <Link
            href={`/sign-up${inviteQuery}`}
            onClick={() => {
              window.sessionStorage.setItem("mmt-connect-invite", inviteToken);
            }}
            className="mt-4 inline-flex items-center gap-2 border border-primary/40 px-6 py-4 text-xs font-bold uppercase tracking-[0.14em] text-primary"
          >
            İlk kez hesap oluştur
          </Link>
        ) : null}
      </section>
    </main>
  );
}

function NoCompanyState() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5">
      <section className="max-w-xl border border-border/70 bg-card p-8 text-center md:p-12">
        <CheckCircle2 className="mx-auto text-primary" size={34} />
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          MMT Connect / Firma Panelim
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Henüz firma kaydı yok.</h1>
        <p className="mt-4 text-sm leading-7 text-foreground/60">
          Önce firma bilgilerinizi ve doğrulama belgenizi gönderin. Firma
          kaydınız oluşunca bu panelden ekip ve görev yönetimi açılacak.
        </p>
        <Link
          href="/b2b-agi/katil"
          className="mt-7 inline-flex items-center gap-2 bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground"
        >
          Firma kaydına geç
        </Link>
      </section>
    </main>
  );
}