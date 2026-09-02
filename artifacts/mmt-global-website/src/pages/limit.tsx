import { FormEvent, useState } from "react";
import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import { Link } from "wouter";

type LimitFormData = {
  fullName: string;
  company: string;
  email: string;
  phone: string;
  requestType: string;
  amount: string;
  currency: string;
  note: string;
};

const initialForm: LimitFormData = {
  fullName: "",
  company: "",
  email: "",
  phone: "",
  requestType: "İşletme sermayesi",
  amount: "",
  currency: "TRY",
  note: "",
};

export default function Limit() {
  const [form, setForm] = useState<LimitFormData>(initialForm);
  const [submitted, setSubmitted] = useState(false);

  const updateField = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
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
            MMT Global / Finansal başvuru
          </div>
          <div className="max-w-3xl">
            <h1 className="text-5xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
              Limit talep
              <span className="block font-serif font-normal italic text-primary">
                formu.
              </span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70 md:text-xl">
              İhtiyacınızı ve büyüme hedefinizi paylaşın. Ekibimiz başvurunuzu
              değerlendirerek size en uygun finansal çözüm için geri dönüş yapsın.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-12 md:px-12 md:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
          <aside className="flex flex-col justify-between">
            <div>
              <p className="font-mono text-sm tracking-widest text-primary">01 / BAŞVURU</p>
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
                <button
                  type="button"
                  onClick={() => {
                    setForm(initialForm);
                    setSubmitted(false);
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
                  <Field
                    label="Şirket"
                    name="company"
                    value={form.company}
                    onChange={updateField}
                    placeholder="Şirket adı"
                    required
                  />
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
                    <span className="font-semibold">Talep türü</span>
                    <select
                      name="requestType"
                      value={form.requestType}
                      onChange={updateField}
                      className="h-12 border-b border-secondary-foreground/25 bg-transparent px-0 text-secondary-foreground outline-none transition-colors focus:border-primary"
                    >
                      <option>İşletme sermayesi</option>
                      <option>Yatırım finansmanı</option>
                      <option>Ticari limit</option>
                      <option>Proje finansmanı</option>
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

                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-semibold">Kısaca ihtiyacınız</span>
                  <textarea
                    name="note"
                    value={form.note}
                    onChange={updateField}
                    placeholder="Finansman ihtiyacınızı ve projenizi kısaca anlatın"
                    rows={5}
                    className="resize-y border-b border-secondary-foreground/25 bg-transparent px-0 py-3 text-secondary-foreground outline-none transition-colors placeholder:text-secondary-foreground/40 focus:border-primary"
                  />
                </label>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-3 bg-primary px-6 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-primary/90"
                >
                  Başvuruyu gönder
                  <Send size={17} />
                </button>
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