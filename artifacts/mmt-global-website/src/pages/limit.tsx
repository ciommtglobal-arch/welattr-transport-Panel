import { FormEvent, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Send,
  Upload,
} from "lucide-react";
import { Link } from "wouter";
import { trackEvent } from "@/lib/analytics";
import {
  createLimitApplication,
  requestUploadUrl,
  type LimitApplicationDocumentInput,
  type LimitApplicationDocumentType,
  type LimitApplicationInput,
} from "@workspace/api-client-react";

type LimitFormData = {
  applicationType: "individual" | "commercial" | "housing" | "vehicle";
  fullName: string;
  company: string;
  email: string;
  phone: string;
  requestType: string;
  amount: string;
  currency: string;
  vehicleDetails: string;
  note: string;
};

const commonDocumentRequirements: Array<{
  type: LimitApplicationDocumentType;
  label: string;
  description: string;
}> = [
  {
    type: "personal_information",
    label: "Şahıs bilgileri",
    description: "Kimlik veya şahıs bilgilerini içeren belge",
  },
  {
    type: "tax_certificate",
    label: "Vergi levhası",
    description: "Güncel vergi levhası",
  },
  {
    type: "signature_circular",
    label: "İmza sirküsü",
    description: "Güncel imza sirküsü veya imza beyannamesi",
  },
  {
    type: "kkb_report",
    label: "KKB raporu",
    description: "Güncel Kredi Kayıt Bürosu raporu",
  },
  {
    type: "findeks_report",
    label: "Findeks raporu",
    description: "Güncel Findeks risk raporu",
  },
];

const sskDocumentRequirement = {
  type: "ssk_service_statement" as const,
  label: "SSK hizmet dökümü",
  description: "Bireysel başvuru için güncel SGK/SSK hizmet dökümü",
};

const categoryConfig = {
  individual: {
    label: "Bireysel",
    title: "Bireysel limit",
    italicTitle: "başvurusu.",
    description:
      "Kişisel ihtiyaçlarınız için size uygun finansman çözümünü birlikte değerlendirelim.",
    requestTypes: ["İhtiyaç finansmanı", "Eğitim finansmanı", "Sağlık finansmanı"],
    requestLabel: "Finansman amacı",
    notePlaceholder: "Finansman ihtiyacınızı kısaca anlatın",
  },
  commercial: {
    label: "Ticari",
    title: "Ticari limit",
    italicTitle: "başvurusu.",
    description:
      "İşletmenizin nakit akışını, yatırım planını ve büyüme hedefini birlikte değerlendirelim.",
    requestTypes: [
      "İşletme sermayesi",
      "Yatırım finansmanı",
      "Ticari limit",
      "Proje finansmanı",
    ],
    requestLabel: "Talep türü",
    notePlaceholder: "Finansman ihtiyacınızı ve projenizi kısaca anlatın",
  },
  housing: {
    label: "Konut",
    title: "Konut finansmanı",
    italicTitle: "başvurusu.",
    description:
      "Konut alımı, yenileme veya mevcut finansmanınızı yapılandırma hedefiniz için çözüm oluşturalım.",
    requestTypes: ["Konut alımı", "Konut yenileme", "Konut refinansmanı"],
    requestLabel: "Finansman amacı",
    notePlaceholder: "Konutun konumu, değeri ve finansman ihtiyacınızı yazın",
  },
  vehicle: {
    label: "Taşıt",
    title: "Taşıt finansmanı",
    italicTitle: "başvurusu.",
    description:
      "Otomobil, ticari araç veya iş makinesi alımınız için finansman seçeneklerini değerlendirelim.",
    requestTypes: ["Otomobil", "Ticari araç", "İş makinesi"],
    requestLabel: "Taşıt türü",
    notePlaceholder: "Taşıt markası, modeli ve finansman ihtiyacınızı yazın",
  },
} as const;

const categoryPath = {
  commercial: "/limit/ticari",
  housing: "/limit/konut",
  vehicle: "/limit/tasit",
  individual: "/limit/bireysel",
} as const;

function createInitialForm(
  category: LimitFormData["applicationType"],
): LimitFormData {
  return {
    applicationType: category,
    fullName: "",
    company: "",
    email: "",
    phone: "",
    requestType: categoryConfig[category].requestTypes[0],
    amount: "",
    currency: "TRY",
    vehicleDetails: "",
    note: "",
  };
};

export function LimitChooser() {
  const categories = ["commercial", "housing", "vehicle", "individual"] as const;

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

      <section className="relative overflow-hidden bg-secondary px-6 py-16 text-secondary-foreground md:px-12 md:py-24">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <p className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-secondary-foreground/55">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            MMT Global / Başvuru merkezi
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
            İhtiyacınıza uygun
            <span className="block font-serif font-normal italic text-primary">
              başvuruyu seçin.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70 md:text-xl">
            Ticari, konut, taşıt veya bireysel finansman başvurunuz için ilgili
            kategoriye tıklayarak ilerleyin.
          </p>
        </div>
      </section>

      <section className="px-6 py-12 md:px-12 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category, index) => {
              const config = categoryConfig[category];
              return (
                <Link
                  key={category}
                  href={categoryPath[category]}
                  onClick={() =>
                    trackEvent("application_category_selected", {
                      category,
                      location: "application_center",
                    })
                  }
                  className="group min-h-64 border border-border/70 bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:bg-secondary hover:text-secondary-foreground md:p-8"
                >
                  <span className="font-mono text-xs tracking-[0.2em] text-primary">
                    0{index + 1}
                  </span>
                  <h2 className="mt-16 text-2xl font-semibold">
                    {config.label}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/60 transition-colors group-hover:text-secondary-foreground/70">
                    {config.description}
                  </p>
                  <span className="mt-7 inline-flex border-b border-primary pb-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    Başvuruya ilerle
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function Limit({
  category,
}: {
  category: LimitFormData["applicationType"];
}) {
  const config = categoryConfig[category];
  const [form, setForm] = useState<LimitFormData>(() =>
    createInitialForm(category),
  );
  const [submitted, setSubmitted] = useState(false);
  const [referenceCode, setReferenceCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadingLabel, setUploadingLabel] = useState("");
  const [documentFiles, setDocumentFiles] = useState<
    Partial<Record<LimitApplicationDocumentType, File>>
  >({});
  const documentRequirements =
    category === "individual"
      ? [...commonDocumentRequirements, sskDocumentRequirement]
      : commonDocumentRequirements;

  const updateField = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    let failureReason = "request_error";

    try {
      const missingDocument = documentRequirements.find(
        (requirement) => !documentFiles[requirement.type],
      );
      if (missingDocument) {
        failureReason = "missing_document";
        throw new Error(`${missingDocument.label} belgesini yükleyin.`);
      }

      const documents = await Promise.all(
        documentRequirements.map(async (requirement) => {
          const file = documentFiles[requirement.type]!;
          setUploadingLabel(`${requirement.label} yükleniyor`);
          const upload = await requestUploadUrl({
            name: file.name,
            size: file.size,
            contentType: file.type as "application/pdf" | "image/jpeg" | "image/png",
          });
          const uploadResponse = await fetch(upload.uploadURL, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!uploadResponse.ok) {
            throw new Error(`${requirement.label} yüklenemedi.`);
          }

          return {
            documentType: requirement.type,
            objectPath: upload.objectPath,
            fileName: file.name,
            contentType: file.type,
            size: file.size,
          } as LimitApplicationDocumentInput;
        }),
      );

      setUploadingLabel("Başvuru kaydediliyor");
      const application = await createLimitApplication({
        ...form,
        company:
          form.company ||
          (category === "individual"
            ? "Bireysel başvuru"
            : category === "housing"
              ? "Konut finansmanı başvurusu"
              : "Taşıt finansmanı başvurusu"),
        vehicleDetails:
          category === "vehicle" ? form.vehicleDetails.trim() : undefined,
        documents,
        note: form.note.trim() || undefined,
      } as LimitApplicationInput);
      setReferenceCode(application.referenceCode);
      setSubmitted(true);
      trackEvent("application_submitted", {
        category,
        request_type: form.requestType,
      });
    } catch (error) {
      trackEvent("application_submission_failed", {
        category,
        reason: failureReason,
      });
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Başvurunuz gönderilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setUploadingLabel("");
      setIsSubmitting(false);
    }
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

      <section className="relative overflow-hidden bg-secondary px-6 py-16 text-secondary-foreground md:px-12 md:py-24">
        <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-8 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-secondary-foreground/55">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            MMT Global / {config.label} başvurusu
          </div>
          <div className="max-w-3xl">
            <h1 className="text-5xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
              {config.title}
              <span className="block font-serif font-normal italic text-primary">
                {config.italicTitle}
              </span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70 md:text-xl">
              {config.description}
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-12 md:px-12 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
          <aside className="flex flex-col justify-between">
            <div>
              <div className="mb-8 grid grid-cols-2 border border-border/70 bg-background/40 md:grid-cols-4">
                {(["commercial", "housing", "vehicle", "individual"] as const).map(
                  (item) => (
                    <Link
                      key={item}
                      href={categoryPath[item]}
                      className={`px-3 py-4 text-center text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors md:px-5 ${
                        item === category
                          ? "bg-primary text-white"
                          : "text-foreground/55 hover:bg-primary/10 hover:text-primary"
                      }`}
                    >
                      {categoryConfig[item].label}
                    </Link>
                  ),
                )}
              </div>
              <p className="font-mono text-sm tracking-widest text-primary">
                01 / {config.label.toUpperCase()}
              </p>
              <h2 className="mt-6 text-3xl font-semibold leading-tight md:text-4xl">
                Doğru yapı,
                <span className="block font-serif font-normal italic text-primary">
                  güçlü büyüme.
                </span>
              </h2>
              <p className="mt-6 leading-relaxed text-foreground/65">
                Formdaki bilgileri mümkün olduğunca eksiksiz doldurmanız,
                değerlendirme sürecimizin daha hızlı ilerlemesine yardımcı olur.
              </p>
            </div>
            <div className="mt-12 border-l-2 border-primary pl-5 text-sm leading-relaxed text-foreground/55">
              Bilgileriniz yalnızca başvurunuzu değerlendirmek ve sizinle
              iletişime geçmek amacıyla kullanılacaktır.
            </div>
          </aside>

          <div className="bg-secondary p-6 text-secondary-foreground md:p-10">
            {submitted ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <CheckCircle2 className="mb-6 h-14 w-14 text-primary" strokeWidth={1.5} />
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
                  Başvurunuz alındı
                </p>
                <h2 className="mt-4 text-3xl font-semibold">Teşekkür ederiz.</h2>
                <p className="mt-5 max-w-md leading-relaxed text-secondary-foreground/65">
                  Finans ekibimiz bilgilerinizi inceleyerek en kısa sürede
                  sizinle iletişime geçecektir.
                </p>
                <div className="mt-6 border border-secondary-foreground/15 bg-background/10 px-5 py-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-secondary-foreground/50">
                    Başvuru referansınız
                  </p>
                  <p className="mt-2 font-mono text-lg tracking-wider text-primary">
                    {referenceCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForm(createInitialForm(category));
                     setDocumentFiles({});
                    setSubmitted(false);
                    setReferenceCode("");
                    setErrorMessage("");
                  }}
                  className="mt-8 border-b border-primary pb-1 text-sm font-semibold uppercase tracking-wider text-primary"
                >
                  Yeni başvuru oluştur
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-7">
                <div className="grid gap-7 md:grid-cols-2">
                  <Field
                    label="Ad soyad"
                    name="fullName"
                    value={form.fullName}
                    onChange={updateField}
                    placeholder="Adınız ve soyadınız"
                    required
                  />
                  {category !== "individual" ? (
                    <Field
                      label={
                        category === "vehicle"
                          ? "Şirket / kurum"
                          : category === "housing"
                            ? "Banka / kurum (opsiyonel)"
                            : "Şirket"
                      }
                      name="company"
                      value={form.company}
                      onChange={updateField}
                      placeholder={
                        category === "vehicle"
                          ? "Varsa şirket veya kurum adı"
                          : category === "housing"
                            ? "Varsa banka veya kurum adı"
                            : "Şirket adı"
                      }
                      required={category === "commercial"}
                    />
                  ) : null}
                  <Field
                    label="E-posta"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateField}
                    placeholder="ornek@sirket.com"
                    required
                  />
                  <Field
                    label="Telefon"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={updateField}
                    placeholder="+90"
                    required
                  />
                </div>

                <div className="grid gap-7 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-semibold">{config.requestLabel}</span>
                    <select
                      name="requestType"
                      value={form.requestType}
                      onChange={updateField}
                      className="h-12 border-b border-secondary-foreground/25 bg-transparent px-0 text-secondary-foreground outline-none transition-colors focus:border-primary"
                    >
                      {config.requestTypes.map((requestType) => (
                        <option key={requestType}>{requestType}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-[1fr_110px] gap-4">
                    <Field
                      label="Talep edilen tutar"
                      name="amount"
                      type="number"
                      min="0"
                      value={form.amount}
                      onChange={updateField}
                      placeholder="0"
                      required
                    />
                    <label className="flex flex-col gap-2 text-sm">
                      <span className="font-semibold">Para birimi</span>
                      <select
                        name="currency"
                        value={form.currency}
                        onChange={updateField}
                        className="h-12 border-b border-secondary-foreground/25 bg-transparent px-0 text-secondary-foreground outline-none transition-colors focus:border-primary"
                      >
                        <option>TRY</option>
                        <option>USD</option>
                        <option>EUR</option>
                        <option>GBP</option>
                      </select>
                    </label>
                  </div>
                </div>

                {category === "vehicle" ? (
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-semibold">Araç bilgileri</span>
                    <textarea
                      name="vehicleDetails"
                      value={form.vehicleDetails}
                      onChange={updateField}
                      placeholder="Marka, model, model yılı, kilometre, satış bedeli ve varsa plaka/şasi bilgisini yazın"
                      rows={4}
                      required
                      className="resize-y border-b border-secondary-foreground/25 bg-transparent px-0 py-3 text-secondary-foreground outline-none transition-colors placeholder:text-secondary-foreground/40 focus:border-primary"
                    />
                  </label>
                ) : null}

                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-semibold">Kısaca ihtiyacınız</span>
                  <textarea
                    name="note"
                    value={form.note}
                    onChange={updateField}
                    placeholder={config.notePlaceholder}
                    rows={5}
                    className="resize-y border-b border-secondary-foreground/25 bg-transparent px-0 py-3 text-secondary-foreground outline-none transition-colors placeholder:text-secondary-foreground/40 focus:border-primary"
                  />
                </label>

                <section className="border border-secondary-foreground/15 bg-background/5 p-5 md:p-6">
                  <div className="mb-5 flex items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <h3 className="font-semibold">Başvuru belgeleri</h3>
                      <p className="mt-1 text-xs leading-relaxed text-secondary-foreground/55">
                        PDF, JPG veya PNG yükleyebilirsiniz. Her dosya en fazla 10 MB olabilir.
                        {category === "individual"
                          ? " SSK hizmet dökümü yalnızca bireysel başvuruda zorunludur."
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {documentRequirements.map((requirement) => {
                      const selectedFile = documentFiles[requirement.type];
                      return (
                        <label
                          key={requirement.type}
                          className="group cursor-pointer border border-secondary-foreground/15 p-4 transition-colors hover:border-primary"
                        >
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                            required
                            className="sr-only"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              setDocumentFiles((current) => ({
                                ...current,
                                [requirement.type]: file,
                              }));
                              if (file) {
                                trackEvent("application_document_selected", {
                                  category,
                                  document_type: requirement.type,
                                });
                              }
                            }}
                          />
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            <Upload className="h-4 w-4 text-primary" />
                            {requirement.label}
                          </span>
                          <span className="mt-2 block text-xs leading-relaxed text-secondary-foreground/45">
                            {selectedFile
                              ? selectedFile.name
                              : requirement.description}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-3 bg-primary px-6 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? uploadingLabel || "Gönderiliyor"
                    : "Başvuruyu gönder"}
                  {isSubmitting ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Send size={17} />
                  )}
                </button>
                {errorMessage ? (
                  <p
                    role="alert"
                    className="border-l-2 border-red-500 pl-4 text-sm leading-relaxed text-red-300"
                  >
                    {errorMessage}
                  </p>
                ) : null}
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  required = false,
}: {
  label: string;
  name: keyof LimitFormData;
  value: string;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => void;
  placeholder: string;
  type?: string;
  min?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-semibold">{label}</span>
      <input
        name={name}
        type={type}
        min={min}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="h-12 border-b border-secondary-foreground/25 bg-transparent px-0 text-secondary-foreground outline-none transition-colors placeholder:text-secondary-foreground/40 focus:border-primary"
      />
    </label>
  );
}