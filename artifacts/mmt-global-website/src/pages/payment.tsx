import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  useCreateTamiHostedPaymentSession,
  useGetPaymentReadiness,
  useGetTamiPaymentStatus,
  useSetMockPaymentResult,
} from "@workspace/api-client-react";

type Currency = "TRY" | "USD" | "EUR";
type MockResult = "success" | "failed";

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

function PaymentShell({ children }: { children: React.ReactNode }) {
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
  const [amount, setAmount] = useState("1000");
  const [currency, setCurrency] = useState<Currency>("TRY");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const payment = useCreateTamiHostedPaymentSession();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    payment.mutate(
      {
        data: {
          amount: Number(amount),
          currency,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          description: description.trim(),
        },
      },
      {
        onSuccess: (session) => {
          window.location.assign(session.paymentUrl);
        },
      },
    );
  }

  return (
    <PaymentShell>
      <section className="border-b border-border/70 bg-secondary px-6 py-14 text-secondary-foreground md:px-12 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <ShieldCheck size={15} />
            MMT Global ticari işlemleri
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
            Ticari ödeme
            <span className="block font-serif font-normal italic text-primary">güvenle ayrı.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70">
            Bu kanal MMT Global&apos;in kendi ticari faaliyetleri ve yetkilendirilmiş
            hizmet tahsilatları içindir. Ücretsiz B2B ağımızdaki temel tanıtım ve
            bağlantı hizmetleri için ödeme gerekmez.
          </p>
          <p className="mt-6 max-w-2xl border-l-2 border-primary bg-primary/10 px-4 py-3 text-sm font-semibold leading-relaxed">
            TEST MODU: Bu sayfa yalnızca ödeme akışını simüle eder. Gerçek kart bilgisi
            istenmez ve gerçek tahsilat yapılmaz.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 md:px-12 lg:grid-cols-[1fr_0.72fr] lg:py-16">
        <form onSubmit={submit} className="border border-border/70 bg-card p-6 md:p-10">
          <div className="mb-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
               Ticari ödeme talebi
            </p>
            <h2 className="mt-2 text-3xl font-semibold">Bilgilerinizi girin</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Ad soyad"
              value={fullName}
              onChange={setFullName}
              placeholder="Ad Soyad"
              required
              autoComplete="name"
            />
            <Field
              label="E-posta"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="ornek@firma.com"
              required
              autoComplete="email"
            />
            <Field
              label="Telefon"
              type="tel"
              value={phone}
              onChange={setPhone}
              placeholder="05xx xxx xx xx"
              required
              autoComplete="tel"
            />
            <label className="block text-sm">
              <span className="mb-2 block text-foreground/60">Para birimi</span>
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value as Currency)}
                className="w-full border border-border bg-background px-4 py-3 outline-none transition-colors focus:border-primary"
              >
                <option value="TRY">TRY — Türk lirası</option>
                <option value="USD">USD — Amerikan doları</option>
                <option value="EUR">EUR — Euro</option>
              </select>
              <span className="mt-2 block text-xs leading-relaxed text-foreground/50">
                Test modunda TRY, USD ve EUR kullanılabilir. Mevcut Tami canlı hesabında
                yalnızca TRY desteklenir; USD/EUR için çoklu para birimi destekleyen
                sağlayıcı gerekir.
              </span>
            </label>
            <Field
              label={`Tutar (${currency})`}
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={setAmount}
              required
            />
          </div>

          <label className="mt-5 block text-sm">
            <span className="mb-2 block text-foreground/60">Ödeme açıklaması</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
               placeholder="Ticari hizmet veya sipariş açıklaması"
              required
              minLength={2}
              maxLength={160}
              rows={4}
              className="w-full resize-y border border-border bg-background px-4 py-3 outline-none transition-colors focus:border-primary"
            />
          </label>

          {payment.isError && (
            <p className="mt-5 flex gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {getApiErrorMessage(payment.error)}
            </p>
          )}

          <button
            type="submit"
            disabled={payment.isPending}
            className="mt-7 flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {payment.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Ödeme sayfası hazırlanıyor
              </>
            ) : (
              <>
                Test ödeme akışını aç
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <aside className="h-fit border border-border/70 bg-secondary p-6 text-secondary-foreground md:p-8">
          <ShieldCheck className="h-8 w-8 text-primary" />
           <h2 className="mt-6 text-2xl font-semibold">Ücretsiz ağ ayrı, ticari ödeme ayrı</h2>
          <ul className="mt-6 space-y-4 text-sm leading-relaxed text-secondary-foreground/70">
             <li>• Üretici tanıtımı, alıcı talepleri ve temel B2B bağlantı hizmetleri için ödeme istenmez.</li>
             <li>• Bu sayfa yalnızca MMT Global&apos;in kendi ticari işlemleri veya yetkilendirilmiş ücretli hizmetleri içindir.</li>
            <li>• Kart numarası, son kullanma tarihi ve CVV bu siteye gönderilmez.</li>
            <li>• Test modu TRY, USD ve EUR tutarlarıyla çalışır.</li>
            <li>• Tami canlı hesabında ticari işlem TRY olur; yabancı kartın dönüşümünü kartı veren banka yapabilir.</li>
            <li>• Yabancı kartlarda oluşabilecek kur farkı veya banka işlem ücreti müşteriye ait olabilir.</li>
            <li>• Test ekranında başarı veya başarısızlık sonucu simüle edilebilir.</li>
          </ul>
          <p className="mt-8 border-t border-secondary-foreground/15 pt-5 text-xs leading-relaxed text-secondary-foreground/50">
            Ödeme yapmadan önce tutar ve açıklamayı kontrol edin.{" "}
            <Link href="/iade" className="underline hover:text-primary">
              İade koşullarını
            </Link>{" "}
            ve{" "}
            <Link href="/hizmet-kosullari" className="underline hover:text-primary">
              hizmet koşullarını
            </Link>{" "}
            inceleyebilirsiniz.
          </p>
        </aside>
      </section>
    </PaymentShell>
  );
}

export function MockPaymentPage() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const orderId = searchParams.get("orderId") ?? "";
  const statusQuery = useGetTamiPaymentStatus(orderId, {
    query: {
      queryKey: [`/api/payments/tami/${orderId}`],
      enabled: Boolean(orderId),
      refetchInterval: (query) =>
        query.state.data?.status === "pending" ? 2000 : false,
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
            başarı ya da başarısızlık olarak tamamlayabilirsiniz.
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
                  <strong>{payment.status === "success" ? "başarılı" : "başarısız"}</strong>{" "}
                  olarak işaretlendi.
                </div>
              ) : (
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
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
  const callbackResult = searchParams.get("result");
  const statusQuery = useGetTamiPaymentStatus(orderId, {
    query: {
      queryKey: [`/api/payments/tami/${orderId}`],
      enabled: Boolean(orderId),
      refetchInterval: (query) =>
        query.state.data?.status === "pending" ? 4000 : false,
    },
  });
  const status = statusQuery.data?.status ?? (callbackResult === "failed" ? "failed" : "pending");
  const isSuccess = status === "success";
  const isMock = statusQuery.data?.providerOrderStatus === "MOCK";

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
          {isMock && isSuccess ? "Test başarılı simüle edildi." : isMock && status === "failed" ? "Test başarısız simüle edildi." : isSuccess ? "Ödeme doğrulandı." : status === "failed" ? "Ödeme tamamlanamadı." : "Ödeme durumu kontrol ediliyor."}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-foreground/65">
          {statusQuery.isError
            ? getApiErrorMessage(statusQuery.error)
            : isMock
              ? "Bu işlem yalnızca bir testtir. Gerçek kart kullanılmadı ve tahsilat yapılmadı."
            : isSuccess
              ? "İşleminiz ödeme sağlayıcısı tarafından başarılı olarak bildirildi."
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
            href="/odeme/test-baslat"
            className="inline-flex items-center justify-center gap-2 bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white"
          >
            Yeni test işlemi
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  min,
  step,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  step?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block text-foreground/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
        autoComplete={autoComplete}
        className="w-full border border-border bg-background px-4 py-3 outline-none transition-colors focus:border-primary"
      />
    </label>
  );
}

const currencies = ["TRY", "EUR", "USD"] as const;

export default function InvoicePaymentPage() {
  const readiness = useGetPaymentReadiness();
  const [invoiceReference, setInvoiceReference] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<(typeof currencies)[number]>("TRY");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    document.title = "Fatura Ödeme | MMT Global";
  }, []);

  const checkout = useCreatePaymentCheckout({
    mutation: {
      onSuccess: (session) => {
        window.location.assign(session.checkoutUrl);
      },
      onError: (error) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Ödeme başlatılamadı. Lütfen daha sonra tekrar deneyin.",
        );
      },
    },
  });

  const canStartCheckout =
    readiness.data?.liveEnabled === true &&
    readiness.data.bankAccountVerified &&
    readiness.data.providerApproved &&
    !checkout.isPending;

  const submitPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (!canStartCheckout) {
      setMessage(
        "Çevrimiçi tahsilat, şirket hesabı ve lisanslı Sanal POS onayları doğrulanana kadar kapalıdır.",
      );
      return;
    }

    checkout.mutate({
      data: { invoiceReference, amount, currency, description },
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
            Fatura ödemenizi
            <span className="block font-serif font-normal italic text-primary">
              güvenle başlatın.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70">
            Yalnızca MMT Global tarafından düzenlenmiş hizmet faturaları için
            ödeme bilgilerini kullanın. Tutar ve açıklama faturanızla aynı
            olmalıdır.
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
                Ödeme tutarını girin
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
                  onChange={(event) => setInvoiceReference(event.target.value)}
                  placeholder="Faturanızdaki referans"
                  className="min-h-12 w-full border border-border bg-background px-4 text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </label>

              <label className="space-y-2 text-sm font-medium">
                <span>Ödenecek tutar</span>
                <div className="flex">
                  <input
                    required
                    inputMode="decimal"
                    pattern="(?=.*[1-9])[0-9]{1,9}(\.[0-9]{1,2})?"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0,00"
                    className="min-h-12 min-w-0 flex-1 border border-r-0 border-border bg-background px-4 text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  <select
                    aria-label="Para birimi"
                    value={currency}
                    onChange={(event) =>
                      setCurrency(event.target.value as (typeof currencies)[number])
                    }
                    className="min-h-12 border border-border bg-background px-3 text-foreground outline-none focus:border-primary"
                  >
                    {currencies.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>

            <label className="block space-y-2 text-sm font-medium">
              <span>Ödeme açıklaması</span>
              <textarea
                required
                maxLength={240}
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Faturadaki hizmet veya ürün açıklaması"
                className="w-full resize-y border border-border bg-background px-4 py-3 text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>

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
              disabled={!canStartCheckout}
              className="flex min-h-14 w-full items-center justify-center gap-3 bg-primary px-6 py-4 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
            >
              {checkout.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CreditCard className="h-5 w-5" />
              )}
              Güvenli ödemeye geç
            </button>
            <p className="text-center text-xs leading-relaxed text-foreground/50">
              Ödeme şu anda kapalıdır. Onay tamamlandığında bu adım sizi
              sağlayıcının güvenli 3D Secure ödeme sayfasına yönlendirecektir.
            </p>
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
                  Tahsilat, şirket hesabı ve sağlayıcı onayları doğrulanmadan
                  başlatılmaz.
                </li>
                <li>Ödeme sağlayıcısının 3D Secure ekranı kullanılacaktır.</li>
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
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                  Şirket hesabı ve lisanslı Sanal POS için gerekli yazılı
                  onaylar doğrulanana kadar çevrimiçi tahsilat kapalıdır.
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
