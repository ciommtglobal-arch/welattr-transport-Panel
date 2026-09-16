import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  Factory,
  Truck,
} from "lucide-react";
import { Link } from "wouter";

const WHATSAPP_PHONE = "441143521434";

const roleDetails = {
  producer: {
    title: "Üreticiyim",
    description: "Ürünümü veya hizmetimi tanıtmak, yeni alıcılara ulaşmak istiyorum.",
    icon: Factory,
  },
  buyer: {
    title: "Alıcıyım",
    description: "Ürün veya hizmet arıyorum; güvenilir üretici ve tedarikçilerle buluşmak istiyorum.",
    icon: Building2,
  },
  logistics: {
    title: "Lojistik / hizmet veriyorum",
    description: "Taşıma, depolama veya tamamlayıcı bir hizmet sunuyorum.",
    icon: Truck,
  },
} as const;

type RoleKey = keyof typeof roleDetails;

export default function FreeB2BNetworkPage() {
  const [selectedRole, setSelectedRole] = useState<RoleKey>("producer");
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Ücretsiz B2B Ağına Katılın | MMT Global";
    const descriptionTag = document.querySelector('meta[name="description"]');
    descriptionTag?.setAttribute(
      "content",
      "MMT Global ücretsiz B2B ağına üretici, alıcı veya lojistik ve hizmet veren olarak katılın.",
    );
  }, []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!fullName.trim() || !contact.trim() || !description.trim()) {
      setError("Lütfen adınızı, iletişim bilginizi ve talebinizi doldurun.");
      return;
    }

    const role = roleDetails[selectedRole].title;
    const message = [
      "MMT Global ücretsiz B2B ağı başvurusu",
      "",
      `Rol: ${role}`,
      `Ad / yetkili: ${fullName.trim()}`,
      `Firma / oluşum: ${organization.trim() || "Belirtilmedi"}`,
      `Şehir / ülke: ${location.trim() || "Belirtilmedi"}`,
      `İletişim: ${contact.trim()}`,
      "",
      "Talep / tanıtım:",
      description.trim(),
      "",
      "Not: Bu başvuru ücretsiz B2B bağlantı ağı içindir. Ücretli üyelik veya zorunlu ödeme içermez.",
    ].join("\n");

    window.open(
      `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setSubmitted(true);
  }

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

      <section className="border-b border-border/70 bg-secondary px-6 py-14 text-secondary-foreground md:px-12 md:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Üret. Tanıt. Sat.
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
            Ücretsiz B2B
            <span className="block font-serif font-normal italic text-primary">ağımıza katılın.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70">
            Üreticileri, alıcıları, lojistik ve hizmet taraflarını güvenilir bağlantılarla
            buluşturuyoruz. Tanıtım, talep paylaşımı ve temel bağlantı hizmetleri ücretsizdir.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10 md:px-12 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr]">
          <div>
            <p className="font-mono text-xs tracking-[0.2em] text-primary">01 / ROLÜNÜZ</p>
            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Ağda hangi taraftasınız?</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-foreground/60">
              Size uygun bağlantıları kurabilmemiz için önce rolünüzü seçin. Kayıt ve temel
              bağlantı hizmetleri için ücret alınmaz.
            </p>

            <div className="mt-8 grid gap-3">
              {(Object.keys(roleDetails) as RoleKey[]).map((role) => {
                const item = roleDetails[role];
                const Icon = item.icon;
                const isSelected = selectedRole === role;

                return (
                  <button
                    key={role}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedRole(role)}
                    className={`flex items-start gap-4 border p-5 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border/70 bg-card hover:border-primary/50"
                    }`}
                  >
                    <span className={`mt-0.5 ${isSelected ? "text-primary" : "text-foreground/50"}`}>
                      <Icon size={23} />
                    </span>
                    <span>
                      <span className="block font-semibold">{item.title}</span>
                      <span className="mt-1 block text-sm leading-6 text-foreground/60">
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 border-t border-border/70 pt-6 text-sm leading-7 text-foreground/60">
              <p>
                Bu form MMT Global&apos;in ücretsiz B2B ağı içindir. Ticari ödeme sayfamız,
                ağ hizmetlerinden ayrı olarak yalnızca kendi ticari işlemlerimizde kullanılır.
              </p>
            </div>
          </div>

          <div className="border border-border/70 bg-card p-6 md:p-10">
            {submitted ? (
              <div className="flex min-h-[28rem] flex-col items-center justify-center text-center">
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <p className="mt-6 font-mono text-xs tracking-[0.2em] text-primary">BAŞVURU HAZIR</p>
                <h2 className="mt-3 text-3xl font-semibold">WhatsApp mesajınız açıldı.</h2>
                <p className="mt-5 max-w-md text-sm leading-7 text-foreground/60">
                  Mesajı kontrol edip gönderdiğinizde ekibimiz talebinizi inceler. Bu işlem
                  ücretsiz ağ bağlantısı içindir; kesin satış veya kazanç garantisi verilmez.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-8 inline-flex items-center gap-2 border border-border px-5 py-3 text-sm font-semibold uppercase tracking-wider transition-colors hover:border-primary hover:text-primary"
                >
                  Yeni talep
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <p className="font-mono text-xs tracking-[0.2em] text-primary">02 / KISA BAŞVURU</p>
                <h2 className="mt-3 text-3xl font-semibold">Kendinizi tanıtın</h2>
                <p className="mt-4 text-sm leading-7 text-foreground/60">
                  Bilgilerinizi yazın; mesajınız gönderilmeden önce WhatsApp ekranında kontrol
                  edebilirsiniz.
                </p>

                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <Field label="Ad / yetkili" value={fullName} onChange={setFullName} required />
                  <Field label="Firma / oluşum" value={organization} onChange={setOrganization} />
                  <Field label="Şehir / ülke" value={location} onChange={setLocation} />
                  <Field label="Telefon veya e-posta" value={contact} onChange={setContact} required />
                </div>

                <label className="mt-5 block text-sm">
                  <span className="mb-2 block text-foreground/60">
                    Ürün, ihtiyaç veya hizmetiniz
                  </span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ne üretiyorsunuz, ne arıyorsunuz veya hangi hizmeti sunuyorsunuz?"
                    required
                    rows={5}
                    maxLength={800}
                    className="w-full resize-y border border-border bg-background px-4 py-3 outline-none transition-colors focus:border-primary"
                  />
                </label>

                {error && (
                  <p className="mt-5 flex gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="mt-7 flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90"
                >
                  WhatsApp&apos;ta devam et
                  <ArrowRight size={16} />
                </button>
                <p className="mt-4 text-xs leading-6 text-foreground/45">
                  Bilgileriniz bu sayfada saklanmaz. Gönderme işlemi, sizin onayınızla
                  WhatsApp mesaj ekranında tamamlanır.
                </p>
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
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block text-foreground/60">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="w-full border border-border bg-background px-4 py-3 outline-none transition-colors focus:border-primary"
      />
    </label>
  );
}