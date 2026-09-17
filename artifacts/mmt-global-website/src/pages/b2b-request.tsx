import { FormEvent, useState } from "react";
import { SignInButton, useAuth } from "@clerk/react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Loader2, MessageSquareText } from "lucide-react";
import {
  useCreateB2BRequest,
  type B2BEmploymentType,
  type B2BRequestCategory,
} from "@workspace/api-client-react";

const categoryLabels: Record<B2BRequestCategory, string> = {
  product: "Ürün arıyorum",
  service: "Hizmet arıyorum",
  logistics: "Lojistik ihtiyacım var",
  partnership: "İş ortağı arıyorum",
  employment: "İş arıyorum",
  other: "Diğer",
};
const fieldClass =
  "h-12 border border-border bg-background px-3 text-sm font-normal outline-none focus:border-primary";
const employmentTypeLabels: Record<B2BEmploymentType, string> = {
  full_time: "Tam zamanlı",
  part_time: "Yarı zamanlı",
  contract: "Sözleşmeli",
  seasonal: "Sezonluk",
  internship: "Staj",
  remote: "Uzaktan",
};

export default function B2BRequestPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [category, setCategory] = useState<B2BRequestCategory>("product");
  const [title, setTitle] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [organization, setOrganization] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [description, setDescription] = useState("");
  const [employmentType, setEmploymentType] =
    useState<B2BEmploymentType>("full_time");
  const [salary, setSalary] = useState("");
  const [experience, setExperience] = useState("");
  const request = useCreateB2BRequest({
    mutation: { onSuccess: () => setSubmitted(true) },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    request.mutate({
      data: {
        category,
        title: title.trim(),
        requesterName: requesterName.trim(),
        organization: organization.trim() || undefined,
        location: location.trim(),
        contact: contact.trim(),
        description: description.trim(),
        employmentType: category === "employment" ? employmentType : undefined,
        salary: category === "employment" ? salary.trim() || undefined : undefined,
        experience:
          category === "employment" ? experience.trim() || undefined : undefined,
      },
    });
  }

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12">
          <Link href="/b2b-agi" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-br-xl rounded-tl-xl bg-primary text-lg font-bold text-white">
              M
            </span>
            <span className="hidden text-lg font-semibold tracking-wider sm:inline">
              MMT <span className="font-light opacity-80">GLOBAL</span>
            </span>
          </Link>
          <Link
            href="/b2b-agi"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/60 hover:text-primary"
          >
            <ArrowLeft size={15} /> B2B ağına dön
          </Link>
        </div>
      </header>

      <section className="border-b border-border/70 bg-secondary px-6 py-14 text-secondary-foreground md:px-12 md:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <MessageSquareText size={15} /> MMT Connect / Alıcı talebi
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
            İhtiyacınızı paylaşın.
            <span className="block font-serif font-normal italic text-primary">
              Doğru bağlantıyı bulalım.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70">
            Aradığınız ürünü, hizmeti, lojistik çözümünü, iş ortağını veya işi
            yazın. MMT ekibi talebi kontrol edip ağı açar.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-16">
        {!isLoaded ? (
          <Loading />
        ) : !isSignedIn ? (
          <div className="border border-border bg-card p-8 text-center md:p-12">
            <h2 className="text-3xl font-semibold font-serif">
              Talep paylaşmak için giriş yapın
            </h2>
            <p className="mx-auto mt-4 max-w-lg leading-relaxed text-foreground/60">
              Her talep MMT tarafından incelenir. Giriş yapmak, talebin gerçek
              bir kişi veya işletmeden geldiğini doğrulamamıza yardımcı olur.
            </p>
            <SignInButton mode="modal">
              <button className="mt-8 bg-primary px-7 py-4 text-sm font-semibold uppercase tracking-wider text-white">
                Giriş yap
              </button>
            </SignInButton>
          </div>
        ) : submitted ? (
          <div className="border border-primary/30 bg-primary/5 p-8 md:p-12">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h2 className="mt-7 text-3xl font-semibold">
              Talebiniz MMT’ye ulaştı
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-foreground/65">
              MMT Global ekibi talebinizi inceleyecek. Onaylandığında talep
              ticaret ağında görünür olacak.
            </p>
            <Link
              href="/b2b-agi"
              className="mt-8 inline-flex bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white"
            >
              Ağa dön
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="border border-border bg-card p-6 md:p-10">
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Talep türü">
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as B2BRequestCategory)}
                  className={fieldClass}
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Talep başlığı">
                <input required minLength={5} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Örn. Türkiye’den mermer tedarikçisi arıyoruz" className={fieldClass} />
              </Field>
              <Field label="Ad soyad">
                <input required minLength={2} maxLength={160} value={requesterName} onChange={(event) => setRequesterName(event.target.value)} className={fieldClass} />
              </Field>
              <Field label="Şirket / kurum (isteğe bağlı)">
                <input maxLength={200} value={organization} onChange={(event) => setOrganization(event.target.value)} className={fieldClass} />
              </Field>
              <Field label="Şehir / ülke">
                <input required minLength={2} maxLength={160} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="İstanbul, Türkiye" className={fieldClass} />
              </Field>
              <Field label="İletişim">
                <input required minLength={5} maxLength={180} value={contact} onChange={(event) => setContact(event.target.value)} placeholder="E-posta veya telefon" className={fieldClass} />
              </Field>
              {category === "employment" ? (
                <>
                  <Field label="Çalışma şekli">
                    <select
                      value={employmentType}
                      onChange={(event) =>
                        setEmploymentType(event.target.value as B2BEmploymentType)
                      }
                      className={fieldClass}
                    >
                      {Object.entries(employmentTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Ücret / maaş bilgisi (isteğe bağlı)">
                    <input maxLength={120} value={salary} onChange={(event) => setSalary(event.target.value)} placeholder="Örn. Görüşmede belirlenir" className={fieldClass} />
                  </Field>
                  <Field label="Deneyim şartı (isteğe bağlı)">
                    <input maxLength={160} value={experience} onChange={(event) => setExperience(event.target.value)} placeholder="Örn. 2 yıl veya yeni mezun" className={fieldClass} />
                  </Field>
                </>
              ) : null}
            </div>
               <Field label={category === "employment" ? "Kendinizi ve aradığınız işi anlatın" : "İhtiyacınızı anlatın"}>
                 <textarea required minLength={20} maxLength={2000} rows={7} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={category === "employment" ? "Mesleğiniz, yetenekleriniz, tercih ettiğiniz şehir ve başlayabileceğiniz zamanı yazın." : "Miktar, özellik, teslim yeri veya aradığınız iş ortağıyla ilgili bilgileri yazın."} className={`${fieldClass} h-auto resize-y`} />
            </Field>
            {request.isError ? (
              <p className="mt-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
                Talep gönderilemedi. Bilgileri kontrol edip tekrar deneyin.
              </p>
            ) : null}
            <button type="submit" disabled={request.isPending} className="mt-7 flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white disabled:opacity-60">
              {request.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              {request.isPending ? "Gönderiliyor..." : "Talebi MMT’ye gönder"}
            </button>
            <p className="mt-4 text-center text-xs leading-relaxed text-foreground/45">
              Talebiniz yayınlanmadan önce MMT Global personeli tarafından kontrol edilir.
            </p>
          </form>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}

function Loading() {
  return (
    <div className="flex min-h-[35vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={30} />
    </div>
  );
}