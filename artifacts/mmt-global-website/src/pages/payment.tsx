import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import {
  useCreatePaymentCheckout,
  getGetPublicServiceInvoiceQueryKey,
  getGetTamiPaymentStatusQueryKey,
  useGetPublicServiceInvoice,
  useGetPaymentReadiness,
  useGetTamiPaymentStatus,
  useSetMockPaymentResult,
} from "@workspace/api-client-react";

type Currency = "TRY" | "USD" | "EUR";
type MockResult = "success" | "failed" | "cancelled";

function formatCurrency(amount: number, currency: Currency) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
  }).format(amount);
}

function getApiErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "Ödeme başlatılamadı. Lütfen bilgileri kontrol edip tekrar deneyin.";
  }

  const data = (error as { data?: unknown }).data;
  if (data && typeof data === "object" && "error" in data) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === "string") return message;
  }

  return "Ödeme başlatılamadı. Lütfen bilgileri kontrol edip tekrar deneyin.";
}

function PaymentShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-br-xl rounded-tl-xl bg-primary text-lg font-bold text-primary-foreground transition-transform group-hover:scale-95">
              M
            </span>
            <span className="text-lg font-semibold tracking-wider">
              MMT <span className="font-light opacity-80">GLOBAL</span>
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:text-primary"
          >
            <ArrowLeft size={15} />
            Ana sayfa
          </Link>
        </div>
      </header>
      {children}
    </main>
  );
}

export function TestPaymentPage() {
  return <InvoicePaymentPage />;
}

export function MockPaymentPage() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const orderId = searchParams.get("orderId") ?? "";
  const statusQuery = useGetTamiPaymentStatus(orderId, {
    query: {
      queryKey: getGetTamiPaymentStatusQueryKey(orderId),
      enabled: Boolean(orderId),
      refetchInterval: (query) =>
        query.state.data?.status === "pending" || query.state.error ? 2000 : false,
    },
  });
  const resultMutation = useSetMockPaymentResult();
  const payment = statusQuery.data;

  function simulate(status: MockResult) {
    if (!orderId) return;
    resultMutation.mutate(
      { orderId, data: { status } },
      {
        onSuccess: () => {
          window.location.assign(`/odeme/sonuc?orderId=${orderId}&result=${status}`);
        },
      },
    );
  }

  return (
    <PaymentShell>
      <section className="border-b border-border/70 bg-secondary px-6 py-14 text-secondary-foreground md:px-12 md:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <ShieldCheck size={15} />
            Test ödeme modu
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
            Sonucu
            <span className="block font-serif font-normal italic text-primary">simüle edin.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70">
            Bu ekran gerçek kart veya gerçek tahsilat kullanmaz. Test akışını
            başarı, başarısızlık veya iptal olarak tamamlayabilirsiniz.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-10 md:px-12 md:py-16">
        <div className="border border-border/70 bg-card p-6 md:p-10">
          {statusQuery.isLoading ? (
            <div className="flex items-center gap-3 text-foreground/65">
              <Loader2 className="h-5 w-5 animate-spin" />
              Test ödeme oturumu yükleniyor
            </div>
          ) : statusQuery.isError ? (
            <p className="flex gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
              <CircleAlert className="h-4 w-4 shrink-0" />
              {getApiErrorMessage(statusQuery.error)}
            </p>
          ) : !payment ? (
            <p className="text-foreground/65">Test ödeme oturumu bulunamadı.</p>
          ) : (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                Test siparişi
              </p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <h2 className="text-4xl font-semibold">
                  {formatCurrency(payment.amount, payment.currency)}
                </h2>
                <span className="font-mono text-xs text-foreground/45">{payment.orderId}</span>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-foreground/65">
                Aşağıdaki seçeneklerden biriyle sağlayıcı sonucunu simüle edin.
                Bu işlem gerçek ödeme başlatmaz.
              </p>

              {payment.status !== "pending" ? (
                <div className="mt-8 border border-primary/20 bg-primary/5 p-4 text-sm">
                  Bu test oturumu zaten{" "}
                  <strong>{payment.status === "success" ? "başarılı" : payment.status === "cancelled" ? "iptal edilmiş" : "başarısız"}</strong>{" "}
                  olarak işaretlendi.
                </div>
              ) : (
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => simulate("success")}
                    disabled={resultMutation.isPending}
                    className="flex items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 size={16} />
                    Başarılı simüle et
                  </button>
                  <button
                    type="button"
                    onClick={() => simulate("failed")}
                    disabled={resultMutation.isPending}
                    className="flex items-center justify-center gap-2 border border-red-500/40 px-5 py-4 text-sm font-semibold uppercase tracking-wider text-red-700 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300"
                  >
                    <CircleAlert size={16} />
                    Başarısız simüle et
                  </button>
                  <button
                    type="button"
                    onClick={() => simulate("cancelled")}
                    disabled={resultMutation.isPending}
                    className="flex items-center justify-center gap-2 border border-border px-5 py-4 text-sm font-semibold uppercase tracking-wider transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    İptal et
                  </button>
                </div>
              )}

              {resultMutation.isError && (
                <p className="mt-5 flex gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {getApiErrorMessage(resultMutation.error)}
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </PaymentShell>
  );
}

export function PaymentResultPage() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const orderId = searchParams.get("orderId") ?? "";
  const statusQuery = useGetTamiPaymentStatus(orderId, {
    query: {
      queryKey: getGetTamiPaymentStatusQueryKey(orderId),
      enabled: Boolean(orderId),
      refetchInterval: (query) =>
        query.state.data?.status === "pending" || query.state.error ? 5000 : false,
    },
  });
  const status = statusQuery.data?.status ?? "pending";
  const isSuccess = status === "success";
  const isMock = statusQuery.data?.mode === "mock";
  const isSandbox = statusQuery.data?.mode === "tami_sandbox";

  useEffect(() => {
    const invoiceReference = statusQuery.data?.invoiceReference;
    if (invoiceReference && status !== "pending") {
      sessionStorage.removeItem(`mmt-payment-idempotency:${invoiceReference}`);
    }
  }, [status, statusQuery.data?.invoiceReference]);

  return (
    <PaymentShell>
      <section className="mx-auto max-w-3xl px-6 py-20 text-center md:px-12 md:py-28">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          {statusQuery.isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="h-8 w-8" />
          ) : (
            <CircleAlert className="h-8 w-8" />
          )}
        </div>
        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          Ödeme sonucu
        </p>
        <h1 className="mt-3 text-4xl font-semibold md:text-6xl">
          {isMock && isSuccess
            ? "Test başarılı simüle edildi."
            : isSandbox && isSuccess
              ? "Tami test ödemesi doğrulandı."
            : isMock && status === "failed"
              ? "Test başarısız simüle edildi."
              : isSandbox && status === "failed"
                ? "Tami test ödemesi tamamlanamadı."
              : isMock && status === "cancelled"
                ? "Test işlemi iptal edildi."
                : isSandbox && status === "cancelled"
                  ? "Tami test işlemi iptal edildi."
                : isSuccess
                  ? "Ödeme doğrulandı."
                  : status === "failed"
                    ? "Ödeme tamamlanamadı."
                    : status === "cancelled"
                      ? "İşlem iptal edildi."
                      : statusQuery.isError
                        ? "Ödeme durumu doğrulanamadı."
                        : "Ödeme durumu kontrol ediliyor."}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-foreground/65">
          {statusQuery.isError
            ? getApiErrorMessage(statusQuery.error)
            : isMock
              ? "Bu işlem yalnızca bir testtir. Gerçek kart kullanılmadı ve tahsilat yapılmadı."
              : isSandbox
                ? "Bu işlem Tami sandbox ortamında doğrulandı; gerçek tahsilat yapılmadı."
            : isSuccess
              ? "Ödeme sağlayıcısının imzalı yanıtı doğrulandı."
              : status === "cancelled"
                ? "Ödeme sağlayıcısı işlemi iptal edilmiş olarak doğruladı."
              : "İşlem sonucu henüz kesinleşmediyse bu sayfa birkaç saniye içinde yeniden kontrol edilir."}
        </p>
        {orderId && (
          <p className="mt-7 font-mono text-xs text-foreground/45">Sipariş no: {orderId}</p>
        )}
        {statusQuery.data && (
          <p className="mt-3 text-sm text-foreground/55">
            Tutar: {formatCurrency(statusQuery.data.amount, statusQuery.data.currency)}
          </p>
        )}
        {statusQuery.data?.errorMessage && (
          <p className="mx-auto mt-6 max-w-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground/70">
            {statusQuery.data.errorMessage}
          </p>
        )}
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/odeme"
            className="inline-flex items-center justify-center gap-2 bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white"
          >
            Fatura ödeme sayfası
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 border border-border px-6 py-3 text-sm font-semibold uppercase tracking-wider transition-colors hover:border-primary hover:text-primary"
          >
            Ana sayfaya dön
            <ExternalLink size={15} />
          </Link>
        </div>
      </section>
    </PaymentShell>
  );
}

export default function InvoicePaymentPage() {
  const readiness = useGetPaymentReadiness();
  const queryReference = useMemo(
    () => new URLSearchParams(window.location.search).get("invoice")?.trim() ?? "",
    [],
  );
  const [invoiceReference, setInvoiceReference] = useState(queryReference);
  const [lookupRequested, setLookupRequested] = useState(Boolean(queryReference));
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const normalizedReference = invoiceReference.trim();
  const invoiceQuery = useGetPublicServiceInvoice(normalizedReference, {
    query: {
      enabled: lookupRequested && normalizedReference.length > 0,
      queryKey: getGetPublicServiceInvoiceQueryKey(normalizedReference),
    },
  });
  const invoice = invoiceQuery.data;
  const previousPayment = useGetTamiPaymentStatus(invoice?.paymentReference ?? "", {
    query: {
      queryKey: getGetTamiPaymentStatusQueryKey(invoice?.paymentReference ?? ""),
      enabled: Boolean(invoice?.paymentReference),
      refetchInterval: (query) =>
        query.state.data?.status === "pending" || query.state.error ? 5000 : false,
    },
  });

  useEffect(() => {
    if (
      invoice?.paymentReference &&
      previousPayment.data &&
      previousPayment.data.status !== "pending"
    ) {
      sessionStorage.removeItem(`mmt-payment-idempotency:${invoice.reference}`);
      void invoiceQuery.refetch();
    }
  }, [
    invoice?.paymentReference,
    invoice?.reference,
    invoiceQuery.refetch,
    previousPayment.data?.status,
  ]);

  useEffect(() => {
    document.title = "Fatura Ödeme | MMT Global";
  }, []);

  const checkout = useCreatePaymentCheckout({
    mutation: {
      onSuccess: (session) => {
        window.location.assign(session.checkoutUrl);
      },
      onError: (error) => {
        setMessage(getApiErrorMessage(error));
        void invoiceQuery.refetch();
      },
    },
  });

  const checkoutEnabled = Boolean(
    readiness.data?.liveEnabled ||
      readiness.data?.sandboxEnabled ||
      readiness.data?.testEnabled,
  );
  const canStartCheckout = Boolean(
    invoice?.canPay && invoice.status === "issued" && checkoutEnabled && !checkout.isPending,
  );

  const submitPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!invoice || !canStartCheckout) {
      setMessage("Ödemeye açık, doğrulanmış bir hizmet faturası bulunamadı.");
      return;
    }

    const keyName = `mmt-payment-idempotency:${invoice.reference}`;
    const idempotencyKey = sessionStorage.getItem(keyName) ?? crypto.randomUUID();
    sessionStorage.setItem(keyName, idempotencyKey);
    checkout.mutate({
      data: {
        invoiceReference: invoice.reference,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        idempotencyKey,
      },
    });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-br-xl rounded-tl-xl bg-primary text-lg font-bold text-primary-foreground transition-transform group-hover:scale-95">
              M
            </span>
            <span className="text-lg font-semibold tracking-wider">
              MMT <span className="font-light opacity-80">GLOBAL</span>
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:text-primary"
          >
            <ArrowLeft size={15} />
            Ana sayfa
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden bg-secondary px-6 py-16 text-secondary-foreground md:px-12 md:py-20">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <p className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-secondary-foreground/55">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            MMT Global / Kurumsal tahsilat
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
            Hizmet faturası
            <span className="block font-serif font-normal italic text-primary">
              güvenli ödeme.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70">
            Yalnızca MMT Global tarafından düzenlenmiş hizmet faturalarını ödeyin.
            Tutar ve para birimi doğrulanmış faturadan alınır; kart bilgileri
            MMT Global sunucularına gönderilmez.
          </p>
        </div>
      </section>

      <section className="px-6 py-12 md:px-12 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <form
            onSubmit={submitPayment}
            className="space-y-7 border border-border/70 bg-card p-6 md:p-10"
          >
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Fatura bilgileri
              </p>
              <h2 className="mt-3 text-2xl font-semibold">
                Faturanızı bulun
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>Fatura / hizmet referansı</span>
                <input
                  required
                  maxLength={80}
                  autoComplete="off"
                  value={invoiceReference}
                  onChange={(event) => {
                    setInvoiceReference(event.target.value);
                    setLookupRequested(false);
                    setMessage("");
                  }}
                  placeholder="Faturanızdaki referans"
                  className="min-h-12 w-full border border-border bg-background px-4 text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => setLookupRequested(true)}
              disabled={!normalizedReference || invoiceQuery.isFetching}
              className="flex min-h-12 items-center justify-center gap-2 border border-border px-5 text-sm font-semibold uppercase tracking-wider transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {invoiceQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Faturayı doğrula
            </button>

            {invoiceQuery.isError && (
              <div role="alert" className="border border-destructive/40 bg-destructive/10 p-4 text-sm">
                Fatura bulunamadı veya doğrulanamadı. Referansı kontrol edip tekrar deneyin.
              </div>
            )}

            {invoice && (
              <div className="space-y-5 border border-border/70 bg-secondary/50 p-5">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                    Doğrulanmış hizmet faturası
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">{invoice.reference}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/65">
                    {invoice.description}
                  </p>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-border/70 pt-4">
                  <span className="text-sm text-foreground/60">Fatura tutarı</span>
                  <strong className="text-2xl font-semibold">
                    {formatCurrency(Number(invoice.amount), invoice.currency as Currency)}
                  </strong>
                </div>
                {!invoice.canPay && (
                  <p className="border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed">
                    {invoice.status !== "issued"
                      ? "Bu fatura artık yeni ödemeye açık değil."
                      : invoice.paymentStatus === "pending"
                        ? "Bu fatura için ödeme sağlayıcıda sürüyor. Sonuç doğrulanana kadar yeni ödeme başlatılamaz."
                        : readiness.data?.liveEnabled && invoice.currency !== "TRY"
                          ? "Tami bu hesapta yalnızca TRY tahsil edebiliyor. Bu döviz faturası canlı ödemeye açık değil."
                          : "Bu fatura için yeni ödeme başlatılamıyor."}
                  </p>
                )}
                {invoice.paymentReference && (
                  <div
                    role="status"
                    aria-live="polite"
                    className="space-y-2 border border-border/70 bg-background p-4 text-sm"
                    data-testid="status-prior-payment"
                  >
                    {previousPayment.isLoading ? (
                      <p>Önceki ödeme sağlayıcıda kontrol ediliyor…</p>
                    ) : previousPayment.isError ? (
                      <p>
                        Önceki ödemenin sonucu şu anda doğrulanamadı. Aynı fatura için
                        yeni ödeme, sağlayıcı sonucu kesinleşene kadar engellenir.
                      </p>
                    ) : previousPayment.data?.status === "success" ? (
                      <p>Sağlayıcı önceki ödemenin başarılı olduğunu doğruladı.</p>
                    ) : previousPayment.data?.status === "failed" ? (
                      <p>Sağlayıcı önceki ödeme denemesini başarısız olarak doğruladı.</p>
                    ) : previousPayment.data?.status === "cancelled" ? (
                      <p>Sağlayıcı önceki ödeme denemesinin iptal edildiğini doğruladı.</p>
                    ) : (
                      <p>Ödeme sonucu sağlayıcıdan bekleniyor; bu sayfa otomatik kontrol eder.</p>
                    )}
                    <Link
                      href={`/odeme/sonuc?orderId=${encodeURIComponent(invoice.paymentReference)}`}
                      className="inline-flex items-center gap-2 font-semibold text-primary underline underline-offset-4"
                    >
                      Ödeme durumunu aç
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
                {invoice.canPay && (
                  <>
                    <div className="grid gap-5 border-t border-border/70 pt-5 sm:grid-cols-2">
                      <label className="space-y-2 text-sm font-medium">
                        <span>Ad soyad</span>
                        <input
                          required
                          autoComplete="name"
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          className="min-h-12 w-full border border-border bg-background px-4 text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-medium">
                        <span>E-posta</span>
                        <input
                          required
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          className="min-h-12 w-full border border-border bg-background px-4 text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-medium sm:col-span-2">
                        <span>Telefon</span>
                        <input
                          required
                          type="tel"
                          autoComplete="tel"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          placeholder="+90 5xx xxx xx xx"
                          className="min-h-12 w-full border border-border bg-background px-4 text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </label>
                    </div>

                    {readiness.data?.sandboxEnabled && !readiness.data.liveEnabled ? (
                      <p className="border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-relaxed">
                        Tami sandbox test modu: gerçek tahsilat yapılmaz.
                      </p>
                    ) : readiness.data?.testEnabled && !readiness.data.liveEnabled ? (
                      <p className="border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-relaxed">
                        Geliştirme test modu: gerçek tahsilat yapılmaz.
                      </p>
                    ) : null}

            {message && (
              <div
                role="alert"
                className="flex gap-3 border border-destructive/40 bg-destructive/10 p-4 text-sm leading-relaxed text-foreground"
              >
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!canStartCheckout || !fullName.trim() || !email.trim() || !phone.trim()}
              className="flex min-h-14 w-full items-center justify-center gap-3 bg-primary px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {checkout.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
              {checkout.isPending
                ? "Güvenli ödeme hazırlanıyor"
                : canStartCheckout
                  ? "Güvenli ödemeye geç"
                  : "Ödeme şu anda kapalı"}
            </button>
            <p className="text-center text-xs leading-relaxed text-foreground/50">
              Kart bilgileri sağlayıcının güvenli sayfasında girilir. Canlı tahsilat,
              sağlayıcı onaylı 3D Secure ve şirket yetkileri doğrulanmadan açılmaz.
            </p>
                  </>
                )}
              </div>
            )}
          </form>

          <aside className="space-y-6">
            <div className="border border-border/70 bg-secondary p-6 text-secondary-foreground md:p-8">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <h2 className="text-lg font-semibold">Ödeme güvenliği</h2>
              </div>
              <ul className="mt-6 space-y-4 text-sm leading-relaxed text-secondary-foreground/70">
                <li>Kart bilgileri MMT Global sitesinde istenmez veya saklanmaz.</li>
                <li>
                  Tutar ve para birimi, MMT Global tarafından düzenlenmiş
                  faturadan okunur.
                </li>
                <li>
                  Sağlayıcı sonucu doğrulanmadan ödeme başarılı gösterilmez.
                </li>
              </ul>
            </div>

            <div
              role="status"
              aria-live="polite"
              className="border border-primary/35 bg-primary/5 p-6 md:p-8"
            >
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Tahsilat durumu
              </p>
              {readiness.isLoading ? (
                <p className="mt-3 text-sm text-foreground/70">
                  Ödeme uygunluğu kontrol ediliyor…
                </p>
              ) : readiness.isError ? (
                <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                  Ödeme uygunluğu doğrulanamadı. Güvenlik nedeniyle çevrimiçi
                  tahsilat başlatılamıyor.
                </p>
              ) : readiness.data?.liveEnabled ? (
                <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                  Fatura bilgilerinizi kontrol edin. Devam ettiğinizde
                  sağlayıcının güvenli ödeme sayfasına yönlendirileceksiniz.
                </p>
              ) : readiness.data?.sandboxEnabled ? (
                <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                  Tami sandbox test modu açık. Bu ortam gerçek tahsilat yapmaz.
                </p>
              ) : readiness.data?.testEnabled ? (
                <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                  Geliştirme test modu açık. Gerçek kart veya gerçek tahsilat
                  kullanılmaz.
                </p>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                  Şirket, banka, sağlayıcı, 3D Secure ve yazılı yetki onayları
                  tamamlanmadığı için çevrimiçi tahsilat kapalıdır.
                </p>
              )}
            </div>

            <p className="text-sm leading-relaxed text-foreground/55">
              Fatura veya ödeme durumunuzla ilgili destek için{" "}
              <a
                href="mailto:info@mmtglobal.com"
                className="font-semibold text-primary underline underline-offset-4"
              >
                info@mmtglobal.com
              </a>{" "}
              adresine yazın.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
