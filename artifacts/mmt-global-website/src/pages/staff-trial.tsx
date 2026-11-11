import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetStaffTrialCandidatesQueryKey,
  getGetStaffTrialCandidateReportsQueryKey,
  getGetStaffTrialCandidateTasksQueryKey,
  getGetStaffTrialTaskReportsQueryKey,
  getGetStaffTrialTasksQueryKey,
  useCreateStaffTrialCandidate,
  useCreateStaffTrialReport,
  useCreateStaffTrialTask,
  useGetStaffTrialCandidates,
  useGetStaffTrialCandidateReports,
  useGetStaffTrialCandidateTasks,
  useGetStaffTrialTaskReports,
  useGetStaffTrialTasks,
  useUpdateStaffTrialCandidateActive,
  useUpdateStaffTrialCandidateEvaluation,
  useUpdateStaffTrialTask,
  type StaffTrialCandidate,
  type StaffTrialTask,
  type StaffTrialTaskStatus,
} from "@workspace/api-client-react";
import { Check, ChevronLeft, ChevronRight, CircleAlert, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

const PAGE_SIZE = 25;

function hasStatus(error: unknown, status: number) {
  return typeof error === "object" && error !== null && "status" in error && error.status === status;
}

const taskStatusLabels: Record<StaffTrialTaskStatus, string> = {
  open: "Açık",
  in_progress: "Devam ediyor",
  blocked: "Engellendi",
  completed: "Tamamlandı",
};

function TrialError({ retry }: { retry: () => void }) {
  return (
    <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert">
      <p>Deneme çalışma alanı verileri alınamadı. Bu bir yetki reddi olmayabilir; bağlantıyı yeniden deneyin.</p>
      <button type="button" data-testid="button-retry-trial" onClick={retry} className="mt-3 inline-flex items-center gap-2 font-semibold text-primary">
        <RefreshCw size={15} /> Yeniden dene
      </button>
    </div>
  );
}

export function TrialCandidateDesk() {
  const [page, setPage] = useState(1);
  const params = { page, pageSize: PAGE_SIZE };
  const tasks = useGetStaffTrialTasks(params, {
    query: { queryKey: getGetStaffTrialTasksQueryKey(params), retry: false },
  });

  return (
    <section className="min-h-[75dvh] bg-background text-foreground">
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 md:py-14">
        <div className="border-b border-border/70 pb-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">MMT Global / Deneme çalışma alanı</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Deneme görevlerim</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-foreground/65 md:text-base">
            Bu alan yalnızca hesabınıza atanmış deneme görevlerini ve bu görevlere ait raporları gösterir. Şirket, lojistik veya normal personel verileri bu alana yüklenmez.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary"><ShieldCheck size={15} /> Deneme erişimi · personel rolü sağlamaz</p>
        </div>
        {tasks.isPending ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-foreground/60" role="status">
            <Loader2 className="animate-spin text-primary" /> Deneme görevleri yükleniyor…
          </div>
        ) : null}
        {tasks.isError && hasStatus(tasks.error, 403) ? (
          <p className="mt-6 border border-border bg-card p-5 text-sm leading-6" role="alert">Deneme erişiminiz etkin değil. Görevler yalnızca aktif deneme erişimiyle görüntülenebilir.</p>
        ) : null}
        {tasks.isError && !hasStatus(tasks.error, 403) ? <div className="mt-6"><TrialError retry={() => void tasks.refetch()} /></div> : null}
        {tasks.isSuccess && tasks.data.items.length === 0 ? (
          <p className="mt-8 border border-border bg-card p-6 text-sm leading-6 text-foreground/60">Hesabınıza atanmış bir deneme görevi bulunmuyor.</p>
        ) : null}
        {tasks.data?.items.length ? (
          <div className="mt-7 grid gap-5">
            {tasks.data.items.map((task) => <CandidateTaskCard key={task.id} task={task} />)}
            <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4 text-sm">
              <button type="button" data-testid="button-trial-tasks-prev" disabled={page <= 1 || tasks.isFetching} onClick={() => setPage((value) => value - 1)} className="inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={16} />Önceki</button>
              <span className="text-xs text-foreground/50">Sayfa {tasks.data.page}</span>
              <button type="button" data-testid="button-trial-tasks-next" disabled={!tasks.data.hasMore || tasks.isFetching} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 disabled:opacity-40">Sonraki<ChevronRight size={16} /></button>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}

function CandidateTaskCard({ task }: { task: StaffTrialTask }) {
  const client = useQueryClient();
  const [reportsPage, setReportsPage] = useState(1);
  const reportsParams = { page: reportsPage, pageSize: PAGE_SIZE };
  const reports = useGetStaffTrialTaskReports(task.id, reportsParams, {
    query: { queryKey: getGetStaffTrialTaskReportsQueryKey(task.id, reportsParams), retry: false },
  });
  const update = useUpdateStaffTrialTask();
  const appendReport = useCreateStaffTrialReport();
  const [status, setStatus] = useState(task.status);
  const [resultText, setResultText] = useState(task.resultText ?? "");
  const [supportReceived, setSupportReceived] = useState(task.supportReceived);
  const [supportDetails, setSupportDetails] = useState(task.supportDetails ?? "");
  const [reportText, setReportText] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setStatus(task.status);
    setResultText(task.resultText ?? "");
    setSupportReceived(task.supportReceived);
    setSupportDetails(task.supportDetails ?? "");
  }, [task.id, task.status, task.resultText, task.supportReceived, task.supportDetails]);

  const saveProgress = () => {
    setFormError("");
    if (status === "completed" && !resultText.trim()) {
      setFormError("Görevi tamamlamak için sonuç açıklaması zorunludur.");
      return;
    }
    update.mutate({ id: task.id, data: { status, resultText: resultText.trim() || null, supportReceived, supportDetails: supportDetails.trim() || null } }, {
      onSuccess: () => void client.invalidateQueries({ queryKey: ["/api/staff/trial-tasks"] }),
    });
  };

  const submitReport = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!reportText.trim()) return;
    appendReport.mutate({ id: task.id, data: { content: reportText.trim() } }, {
      onSuccess: () => {
        setReportText("");
        void client.invalidateQueries({ queryKey: [`/api/staff/trial-tasks/${task.id}/reports`] });
      },
    });
  };

  return (
    <article className="min-w-0 border border-border bg-card p-5 sm:p-7" data-testid={`card-trial-task-${task.id}`}>
      <div className="flex flex-col justify-between gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Deneme görevi · #{task.id}</p>
          <h2 className="mt-2 break-words text-xl font-semibold">{task.title}</h2>
          {task.description ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/60">{task.description}</p> : null}
        </div>
        <span className="w-fit shrink-0 border border-border px-3 py-2 text-xs font-semibold">{taskStatusLabels[task.status]}</span>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Durum
          <select data-testid={`select-trial-status-${task.id}`} value={status} onChange={(event) => setStatus(event.target.value as StaffTrialTaskStatus)} className="min-h-11 border border-border bg-background px-3">
            {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 self-end border border-border px-3 py-2 text-sm">
          <input data-testid={`checkbox-support-${task.id}`} type="checkbox" checked={supportReceived} onChange={(event) => setSupportReceived(event.target.checked)} />
          Gerekli desteği aldım
        </label>
      </div>
      <label className="mt-4 grid gap-2 text-sm font-medium">
        Aldığınız destek
        <textarea data-testid={`textarea-support-details-${task.id}`} value={supportDetails} onChange={(event) => setSupportDetails(event.target.value)} maxLength={2000} rows={3} className="w-full resize-y border border-border bg-background p-3 text-sm leading-6" placeholder="Aldığınız desteği kısaca açıklayın…" />
      </label>
      <label className="mt-4 grid gap-2 text-sm font-medium">
        Sonuç / ilerleme
        <textarea data-testid={`textarea-result-${task.id}`} value={resultText} onChange={(event) => setResultText(event.target.value)} maxLength={8000} rows={4} className="w-full resize-y border border-border bg-background p-3 text-sm leading-6" placeholder="Sonuç veya ilerleme notunuzu yazın…" />
      </label>
      {formError ? <p className="mt-2 text-sm text-destructive" role="alert">{formError}</p> : null}
      {update.isError ? <p className="mt-2 text-sm text-destructive" role="alert">Görev güncellenemedi. Lütfen yeniden deneyin.</p> : null}
      <button type="button" data-testid={`button-save-trial-task-${task.id}`} disabled={update.isPending} onClick={saveProgress} className="mt-4 inline-flex min-h-11 items-center gap-2 bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {update.isPending ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} İlerlemeyi kaydet
      </button>

      <section className="mt-7 border-t border-border/70 pt-5">
        <h3 className="font-semibold">Görev raporları</h3>
        {reports.isPending ? <p className="mt-3 text-sm text-foreground/50" role="status">Raporlar yükleniyor…</p> : null}
        {reports.isError ? (
          <div className="mt-3 text-sm" role="alert">
            <p className={hasStatus(reports.error, 403) ? "text-destructive" : "text-foreground/60"}>
              {hasStatus(reports.error, 403) ? "Deneme erişiminiz artık etkin değil; bu görevin raporları gösterilemiyor." : "Raporlar bağlantı nedeniyle yüklenemedi."}
            </p>
            {!hasStatus(reports.error, 403) ? <button type="button" data-testid={`button-retry-task-reports-${task.id}`} onClick={() => void reports.refetch()} className="mt-2 font-semibold text-primary">Yeniden dene</button> : null}
          </div>
        ) : null}
        {reports.isSuccess && reports.data.items.length === 0 ? <p className="mt-3 text-sm text-foreground/50">Henüz rapor eklenmedi.</p> : null}
        {reports.data?.items.map((report) => (
          <article key={report.id} data-testid={`text-trial-report-${report.id}`} className="mt-3 border-l-2 border-primary/50 bg-secondary/40 p-3">
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{report.content}</p>
            <time className="mt-2 block text-xs text-foreground/45">{new Date(report.createdAt).toLocaleString("tr-TR")}</time>
          </article>
        ))}
        {reports.data ? <div className="mt-3 flex items-center justify-between text-xs">
          <button type="button" data-testid={`button-task-reports-prev-${task.id}`} disabled={reportsPage <= 1 || reports.isFetching} onClick={() => setReportsPage((value) => value - 1)} className="inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={14} />Önceki</button>
          <span>{reports.data.page}. sayfa</span>
          <button type="button" data-testid={`button-task-reports-next-${task.id}`} disabled={!reports.data.hasMore || reports.isFetching} onClick={() => setReportsPage((value) => value + 1)} className="inline-flex items-center gap-1 disabled:opacity-40">Sonraki<ChevronRight size={14} /></button>
        </div> : null}
        <form onSubmit={submitReport} className="mt-4">
          <label className="grid gap-2 text-sm font-medium">
            Yeni rapor ekle
            <textarea data-testid={`textarea-report-${task.id}`} value={reportText} onChange={(event) => setReportText(event.target.value)} maxLength={8000} rows={3} className="w-full resize-y border border-border bg-background p-3 text-sm" required />
          </label>
          {appendReport.isError ? <p className="mt-2 text-sm text-destructive" role="alert">Rapor eklenemedi. Lütfen yeniden deneyin.</p> : null}
          <button type="submit" data-testid={`button-add-report-${task.id}`} disabled={appendReport.isPending || !reportText.trim()} className="mt-3 min-h-11 border border-primary px-4 text-sm font-bold text-primary disabled:opacity-50">
            {appendReport.isPending ? "Ekleniyor…" : "Raporu ekle"}
          </button>
        </form>
      </section>
    </article>
  );
}

export function FounderTrialCandidates() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const candidatesParams = { page, pageSize: PAGE_SIZE };
  const candidates = useGetStaffTrialCandidates(candidatesParams, {
    query: { queryKey: getGetStaffTrialCandidatesQueryKey(candidatesParams), retry: false },
  });
  const selected = candidates.data?.items.find((candidate) => candidate.clerkUserId === selectedId);
  const grant = useCreateStaffTrialCandidate();

  useEffect(() => {
    if (!selected && candidates.data?.items.length) setSelectedId(candidates.data.items[0].clerkUserId);
  }, [candidates.data, selected]);

  const onGrant = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!email.trim()) return;
    grant.mutate({ data: { email: email.trim() } }, {
      onSuccess: (candidate) => {
        setEmail("");
        setSelectedId(candidate.clerkUserId);
        setPage(1);
        void client.invalidateQueries({ queryKey: ["/api/staff/trial-candidates"] });
      },
    });
  };

  return (
    <section className="mmt-panel mt-7" aria-labelledby="trial-candidates-title">
      <h2 id="trial-candidates-title"><ShieldCheck size={18} aria-hidden="true" />Deneme adayları</h2>
      <p className="mmt-management-sub">
        Bu geliştirme sırasında gerçek bir adaya erişim verilmedi. Buradan yalnızca tam olarak eşleşen ve Clerk hesabındaki e-postası doğrulanmış mevcut hesaplara deneme erişimi tanımlanabilir. Deneme erişimi personel rolüne veya şirket üyeliğine dönüşmez.
      </p>
      <form onSubmit={onGrant} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="grid gap-2 text-sm font-semibold">
          Doğrulanmış hesabın e-posta adresi
          <input data-testid="input-trial-grant-email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11 min-w-0 border border-[var(--line)] bg-[var(--paper)] px-3 text-[var(--ink)]" />
        </label>
        <button type="submit" data-testid="button-grant-trial" disabled={grant.isPending} className="min-h-11 self-end bg-[var(--accent)] px-5 font-semibold text-white disabled:opacity-50">{grant.isPending ? "Doğrulanıyor…" : "Deneme erişimi ver"}</button>
      </form>
      {grant.isError ? <p className="mt-3 text-sm text-red-700" role="alert">Erişim verilemedi. E-posta tam eşleşmeli, tek bir mevcut hesaba ait ve doğrulanmış olmalıdır.</p> : null}
      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.6fr)]">
        <div className="min-w-0">
          <h3 className="font-semibold">Erişim kayıtları</h3>
          {candidates.isPending ? <p className="mt-3 text-sm text-[var(--muted)]" role="status">Aday kayıtları yükleniyor…</p> : null}
          {candidates.isError ? <div className="mt-3 text-sm" role="alert"><p>Adaylar alınamadı (erişim veya bağlantı sorunu).</p><button type="button" data-testid="button-retry-trial-candidates" onClick={() => void candidates.refetch()} className="mt-2 inline-flex items-center gap-2 font-semibold"><RefreshCw size={14} />Yeniden dene</button></div> : null}
          {candidates.isSuccess && candidates.data.items.length === 0 ? <p className="mt-3 border border-[var(--line)] p-4 text-sm leading-6 text-[var(--muted)]">Henüz gerçek bir aday için deneme erişimi verilmedi. İlk erişim ancak doğrulanmış e-posta hesabı eşleştiğinde oluşturulur.</p> : null}
          <div className="mt-3 grid gap-2">
            {candidates.data?.items.map((candidate) => (
              <button type="button" key={candidate.clerkUserId} data-testid={`button-select-trial-candidate-${candidate.clerkUserId}`} aria-pressed={selectedId === candidate.clerkUserId} onClick={() => setSelectedId(candidate.clerkUserId)} className={`min-w-0 border p-3 text-left ${selectedId === candidate.clerkUserId ? "border-primary bg-primary/5" : "border-[var(--line)]"}`}>
                <span className="block break-all font-semibold">{candidate.verifiedEmail}</span>
                <span className={`mt-2 inline-block text-xs font-bold ${candidate.active ? "text-emerald-700" : "text-red-700"}`}>{candidate.active ? "Aktif deneme erişimi" : "Erişim kapalı"}</span>
              </button>
            ))}
          </div>
          {candidates.data ? <div className="mt-4 flex items-center justify-between gap-2 text-xs">
            <button type="button" data-testid="button-trial-candidates-prev" disabled={page <= 1 || candidates.isFetching} onClick={() => setPage((value) => value - 1)} className="inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={15} />Önceki</button>
            <span>{candidates.data.page}. sayfa</span>
            <button type="button" data-testid="button-trial-candidates-next" disabled={!candidates.data.hasMore || candidates.isFetching} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 disabled:opacity-40">Sonraki<ChevronRight size={15} /></button>
          </div> : null}
        </div>
        {selected ? <FounderCandidateReview key={selected.clerkUserId} candidate={selected} /> : <div className="flex min-h-40 items-center justify-center border border-dashed border-[var(--line)] p-5 text-sm text-[var(--muted)]">İncelemek için bir aday seçin.</div>}
      </div>
    </section>
  );
}

function FounderCandidateReview({ candidate }: { candidate: StaffTrialCandidate }) {
  const client = useQueryClient();
  const [taskPage, setTaskPage] = useState(1);
  const params = { page: taskPage, pageSize: PAGE_SIZE };
  const [reportsPage, setReportsPage] = useState(1);
  const reportParams = { page: reportsPage, pageSize: PAGE_SIZE };
  const tasks = useGetStaffTrialCandidateTasks(candidate.clerkUserId, params, {
    query: { queryKey: getGetStaffTrialCandidateTasksQueryKey(candidate.clerkUserId, params), retry: false },
  });
  const reports = useGetStaffTrialCandidateReports(candidate.clerkUserId, reportParams, {
    query: { queryKey: getGetStaffTrialCandidateReportsQueryKey(candidate.clerkUserId, reportParams), retry: false },
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [evaluationNote, setEvaluationNote] = useState(candidate.evaluationNote ?? "");
  const createTask = useCreateStaffTrialTask();
  const updateActive = useUpdateStaffTrialCandidateActive();
  const updateEvaluation = useUpdateStaffTrialCandidateEvaluation();

  useEffect(() => setEvaluationNote(candidate.evaluationNote ?? ""), [candidate.clerkUserId, candidate.evaluationNote]);

  const submitTask = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    createTask.mutate({ data: { clerkUserId: candidate.clerkUserId, title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}) } }, {
      onSuccess: () => {
        setTitle("");
        setDescription("");
        void client.invalidateQueries({ queryKey: getGetStaffTrialCandidateTasksQueryKey(candidate.clerkUserId, params) });
      },
    });
  };

  const saveEvaluation = () => updateEvaluation.mutate({ clerkUserId: candidate.clerkUserId, data: { evaluationNote: evaluationNote.trim() || null } }, {
    onSuccess: () => void client.invalidateQueries({ queryKey: ["/api/staff/trial-candidates"] }),
  });
  const toggleActive = () => updateActive.mutate({ clerkUserId: candidate.clerkUserId, data: { active: !candidate.active } }, {
    onSuccess: () => void client.invalidateQueries({ queryKey: ["/api/staff/trial-candidates"] }),
  });

  return (
    <div className="min-w-0 space-y-5">
      <section className="border border-[var(--line)] p-4 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <p className="mmt-kicker">Seçili deneme adayı</p>
            <p className="mt-2 break-all font-semibold">{candidate.verifiedEmail}</p>
            <p className="mt-2 text-sm font-semibold">{candidate.active ? "Deneme erişimi aktif" : "Deneme erişimi devre dışı"}</p>
          </div>
          <button type="button" data-testid="button-toggle-trial-active" disabled={updateActive.isPending} onClick={toggleActive} className="min-h-10 shrink-0 border border-[var(--line)] px-3 text-sm font-semibold disabled:opacity-50">
            {updateActive.isPending ? "Kaydediliyor…" : candidate.active ? "Erişimi iptal et" : "Erişimi etkinleştir"}
          </button>
        </div>
        {updateActive.isError ? <p className="mt-2 text-sm text-red-700" role="alert">Erişim durumu değiştirilemedi.</p> : null}
      </section>

      <form onSubmit={submitTask} className="border border-[var(--line)] p-4 sm:p-5">
        <h3 className="font-semibold">Adaya deneme görevi ata</h3>
        <label className="mt-3 grid gap-2 text-sm font-medium">Görev başlığı
          <input data-testid="input-trial-task-title" required maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-11 min-w-0 border border-[var(--line)] bg-[var(--paper)] px-3 text-[var(--ink)]" />
        </label>
        <label className="mt-3 grid gap-2 text-sm font-medium">Açıklama (isteğe bağlı)
          <textarea data-testid="textarea-trial-task-description" maxLength={8000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="w-full border border-[var(--line)] bg-[var(--paper)] p-3 text-sm text-[var(--ink)]" />
        </label>
        {createTask.isError ? <p className="mt-2 text-sm text-red-700" role="alert">Görev atanamadı. Adayın deneme erişiminin aktif olduğunu doğrulayın.</p> : null}
        <button type="submit" data-testid="button-create-trial-task" disabled={createTask.isPending} className="mt-3 min-h-11 bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50">{createTask.isPending ? "Atanıyor…" : "Görev oluştur"}</button>
      </form>

      <section className="border border-[var(--line)] p-4 sm:p-5">
        <h3 className="font-semibold">Görevler, sonuçlar ve destek</h3>
        {tasks.isPending ? <p className="mt-3 text-sm text-[var(--muted)]" role="status">Görevler yükleniyor…</p> : null}
        {tasks.isError ? <div className="mt-3 text-sm" role="alert"><p>Görevler alınamadı.</p><button type="button" data-testid="button-retry-founder-trial-tasks" onClick={() => void tasks.refetch()} className="mt-2 inline-flex items-center gap-2 font-semibold"><RefreshCw size={14} />Yeniden dene</button></div> : null}
        {tasks.isSuccess && !tasks.data.items.length ? <p className="mt-3 text-sm text-[var(--muted)]">Bu adaya henüz görev atanmamış.</p> : null}
        <div className="mt-3 grid gap-3">
          {tasks.data?.items.map((task) => (
            <article key={task.id} data-testid={`card-founder-trial-task-${task.id}`} className="min-w-0 border border-[var(--line)] bg-[var(--paper)] p-3">
              <h4 className="break-words font-semibold">{task.title}</h4>
              {task.description ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--muted)]">{task.description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs"><span>Durum: {taskStatusLabels[task.status]}</span><span>Destek alındı: {task.supportReceived ? "Evet" : "Hayır"}</span></div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6"><strong>Alınan destek:</strong> {task.supportDetails || "Destek ayrıntısı belirtilmedi."}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{task.resultText || "Henüz sonuç notu yok."}</p>
            </article>
          ))}
        </div>
        {tasks.data ? <div className="mt-4 flex items-center justify-between text-xs">
          <button type="button" data-testid="button-founder-tasks-prev" disabled={taskPage <= 1 || tasks.isFetching} onClick={() => setTaskPage((value) => value - 1)} className="inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={15} />Önceki</button>
          <span>{tasks.data.page}. sayfa</span>
          <button type="button" data-testid="button-founder-tasks-next" disabled={!tasks.data.hasMore || tasks.isFetching} onClick={() => setTaskPage((value) => value + 1)} className="inline-flex items-center gap-1 disabled:opacity-40">Sonraki<ChevronRight size={15} /></button>
        </div> : null}
      </section>

      <section className="border border-[var(--line)] p-4 sm:p-5">
        <h3 className="font-semibold">Aday raporları</h3>
        {reports.isPending ? <p className="mt-3 text-sm text-[var(--muted)]" role="status">Raporlar yükleniyor…</p> : null}
        {reports.isError ? <p className="mt-3 text-sm text-red-700" role="alert">Raporlar alınamadı.</p> : null}
        {reports.isSuccess && reports.data.items.length === 0 ? <p className="mt-3 text-sm text-[var(--muted)]">Henüz rapor bulunmuyor.</p> : null}
        {reports.data?.items.map((report) => (
          <article key={report.id} data-testid={`text-founder-trial-report-${report.id}`} className="mt-3 border-l-2 border-[var(--accent)] bg-[var(--paper)] p-3">
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{report.content}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">Görev #{report.taskId} · {new Date(report.createdAt).toLocaleString("tr-TR")}</p>
          </article>
        ))}
        {reports.data ? <div className="mt-4 flex items-center justify-between text-xs">
          <button type="button" data-testid="button-founder-reports-prev" disabled={reportsPage <= 1 || reports.isFetching} onClick={() => setReportsPage((value) => value - 1)} className="inline-flex items-center gap-1 disabled:opacity-40"><ChevronLeft size={15} />Önceki</button>
          <span>{reports.data.page}. sayfa</span>
          <button type="button" data-testid="button-founder-reports-next" disabled={!reports.data.hasMore || reports.isFetching} onClick={() => setReportsPage((value) => value + 1)} className="inline-flex items-center gap-1 disabled:opacity-40">Sonraki<ChevronRight size={15} /></button>
        </div> : null}
      </section>

      <section className="border border-[var(--line)] p-4 sm:p-5">
        <h3 className="font-semibold">Kurucu değerlendirme notu <span className="font-normal text-xs text-[var(--muted)]">(yalnızca kurucu)</span></h3>
        <textarea data-testid="textarea-trial-evaluation" maxLength={8000} rows={4} value={evaluationNote} onChange={(event) => setEvaluationNote(event.target.value)} className="mt-3 w-full border border-[var(--line)] bg-[var(--paper)] p-3 text-sm text-[var(--ink)]" />
        {updateEvaluation.isError ? <p className="mt-2 text-sm text-red-700" role="alert">Değerlendirme notu kaydedilemedi.</p> : null}
        {updateEvaluation.isSuccess ? <p className="mt-2 text-sm text-emerald-700" role="status">Değerlendirme notu kaydedildi.</p> : null}
        <button type="button" data-testid="button-save-trial-evaluation" disabled={updateEvaluation.isPending} onClick={saveEvaluation} className="mt-3 min-h-10 border border-[var(--line)] px-4 text-sm font-semibold disabled:opacity-50">{updateEvaluation.isPending ? "Kaydediliyor…" : "Notu kaydet"}</button>
        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[var(--muted)]"><CircleAlert size={14} className="mt-0.5 shrink-0" />Bu not adayın görebileceği görev raporlarına eklenmez. Buradaki işlemler şirket üyeliği veya personel rolü oluşturmaz.</p>
      </section>
    </div>
  );
}