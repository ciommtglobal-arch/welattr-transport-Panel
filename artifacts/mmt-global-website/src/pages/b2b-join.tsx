import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Loader2,
  Upload,
} from "lucide-react";
import {
  createMyB2BBusinessProfile,
  getGetB2BListingsQueryKey,
  getGetMyB2BBusinessProfileQueryKey,
  requestB2BBusinessVerificationUploadUrl,
  requestB2BListingImageUploadUrl,
  useCreateB2BListing,
  useGetMyB2BBusinessProfile,
  type B2BListing,
  type B2BEmploymentType,
  type B2BListingRole,
  type B2BBusinessRole,
  type B2BBusinessProfile,
  type B2BBusinessProfileInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type DocumentContentType = "application/pdf" | "image/jpeg" | "image/png";
type BusinessProfileForm = {
  legalName: string;
  publicName: string;
  country: string;
  city: string;
  contactName: string;
  phone: string;
  email: string;
  registrationNumber: string;
  businessType: string;
  field: string;
  roles: B2BBusinessRole[];
  website: string;
};

type ListingSocials = {
  instagram: string;
  facebook: string;
  linkedin: string;
  telegram: string;
  tiktok: string;
};

type ListingDraft = {
  role: B2BListingRole;
  title: string;
  fullName: string;
  location: string;
  description: string;
  employmentType: B2BEmploymentType;
  salary: string;
  experience: string;
  socials: ListingSocials;
};

const emptyListingSocials: ListingSocials = {
  instagram: "",
  facebook: "",
  linkedin: "",
  telegram: "",
  tiktok: "",
};

const businessRoleOptions: Array<[B2BBusinessRole, string]> = [
  ["producer", "Üretici"],
  ["buyer", "Alıcı"],
  ["logistics", "Lojistik / Hizmet"],
  ["employer", "İşveren"],
];

const statusCopy: Record<
  B2BBusinessProfile["status"],
  { title: string; description: string }
> = {
  pending: {
    title: "Doğrulama bekliyor",
    description:
      "Resmi belgeniz MMT Global ekibi tarafından inceleniyor. Profiliniz doğrulandığında yeni ilanlarınız doğrudan yayınlanabilecek.",
  },
  verified: {
    title: "İşletmeniz doğrulandı",
    description:
      "Artık kendi alanınızda ücretsiz ilan yayınlayabilir, web sitenize ve medya kanallarınıza trafik çekebilirsiniz.",
  },
  rejected: {
    title: "Ek bilgi gerekiyor",
    description:
      "Doğrulama tamamlanamadı. MMT Global ekibinin notlarını kontrol edip yeni başvuru için bize ulaşın.",
  },
  suspended: {
    title: "Profil geçici olarak askıda",
    description:
      "Profilinizin yayın yetkisi geçici olarak durduruldu. Destek için MMT Global ekibiyle iletişime geçin.",
  },
};
const employmentTypeLabels: Record<B2BEmploymentType, string> = {
  full_time: "Tam zamanlı",
  part_time: "Yarı zamanlı",
  contract: "Sözleşmeli",
  seasonal: "Sezonluk",
  internship: "Staj",
  remote: "Uzaktan",
};

export default function B2BJoinPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [showWelcome, setShowWelcome] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("welcome") === "1",
  );
  const profileQuery = useGetMyB2BBusinessProfile({
    query: {
      queryKey: getGetMyB2BBusinessProfileQueryKey(),
      enabled: isLoaded && Boolean(isSignedIn),
      retry: false,
    },
  });

  if (!isLoaded) {
    return <LoadingState />;
  }

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <Header />
      <section className="border-b border-border/70 bg-secondary px-6 py-14 text-secondary-foreground md:px-12 md:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            MMT Connect / Uluslararası B2B ağı
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
            İşletmenizi tanıtın.
            <span className="block font-serif font-normal italic text-primary">
              Yeni bağlantılar kurun.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70 md:text-xl">
             İşletmenizi bir kez doğrulayın; üretici, alıcı, lojistik, hizmet
             sağlayıcı veya işveren olarak kendi ilanlarınızı ücretsiz yayınlayın.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
        {!isSignedIn ? (
          <SignInPrompt />
        ) : showWelcome ? (
          <WelcomeState
            onContinue={() => {
              setShowWelcome(false);
              window.history.replaceState(
                null,
                "",
                `${window.location.pathname}${window.location.hash}`,
              );
            }}
          />
        ) : profileQuery.isLoading ? (
          <LoadingState />
        ) : profileQuery.data ? (
          profileQuery.data.status === "verified" ? (
            <VerifiedPublisher profile={profileQuery.data} />
          ) : profileQuery.data.status === "rejected" ? (
            <VerificationForm initialProfile={profileQuery.data} />
          ) : (
            <ProfileStatus profile={profileQuery.data} />
          )
        ) : (
          <VerificationForm />
        )}
      </section>
    </main>
  );
}

function WelcomeState({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="mx-auto max-w-3xl border border-primary/30 bg-card p-8 md:p-14">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="h-8 w-8 text-primary" />
      </div>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        MMT Global Connect / Üyelik
      </p>
      <h2 className="mt-4 text-4xl font-semibold leading-tight md:text-5xl">
        Hoş geldiniz.
        <span className="block font-serif font-normal italic text-primary">
          Hesabınız başarıyla oluşturuldu.
        </span>
      </h2>
      <p className="mt-6 max-w-2xl text-base leading-relaxed text-foreground/65 md:text-lg">
        MMT Global Connect hesabınız hazır. Şimdi işletme bilgilerinizi ve
        resmi belgenizi ekleyerek uluslararası üretici, alıcı, işveren ve
        lojistik ekosistemine katılabilirsiniz.
      </p>
      <div className="mt-8 grid gap-3 border-l-2 border-primary pl-4 text-sm text-foreground/70 md:grid-cols-3 md:border-l-0 md:border-t-2 md:pl-0 md:pt-4">
        <span>Hesap oluşturuldu</span>
        <span>Firma profili hazırlanacak</span>
        <span>Tek seferlik doğrulama</span>
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="mt-10 inline-flex items-center gap-3 bg-primary px-6 py-4 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90"
      >
        Firma profilini tamamla
        <ArrowRight size={17} />
      </button>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border/70 bg-background/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12">
        <Link href="/b2b-agi" className="group flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-br-xl rounded-tl-xl bg-primary text-lg font-bold text-primary-foreground transition-transform group-hover:scale-95">
            M
          </span>
          <span className="text-lg font-semibold tracking-wider">
            MMT <span className="font-light opacity-80">CONNECT</span>
          </span>
        </Link>
        <Link
          href="/b2b-agi"
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:text-primary"
        >
          <ArrowLeft size={15} />
          Ağa dön
        </Link>
      </div>
    </header>
  );
}

function SignInPrompt() {
  return (
    <div className="mx-auto grid max-w-4xl gap-10 border border-border/70 bg-card p-8 md:grid-cols-[1fr_auto] md:p-12">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Ücretsiz katılım
        </p>
        <h2 className="mt-4 text-3xl font-semibold">
          Önce ücretsiz hesabınızı oluşturun.
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-foreground/65">
          Hesabınız işletme profilinizi ve ilanlarınızı yönetmeniz için
          kullanılacak. MMT Connect’e katılım ve ilan yayınlamak ücretsizdir.
        </p>
      </div>
      <div className="flex flex-col justify-center gap-3 sm:flex-row md:flex-col">
        <Link
          href="/sign-up"
          className="bg-primary px-6 py-3 text-center text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90"
        >
          Hesap oluştur
        </Link>
        <Link
          href="/sign-in"
          className="border border-border/70 px-6 py-3 text-center text-sm font-semibold uppercase tracking-wider transition-colors hover:border-primary hover:text-primary"
        >
          Giriş yap
        </Link>
      </div>
    </div>
  );
}

function VerificationForm({
  initialProfile,
}: {
  initialProfile?: B2BBusinessProfile;
}) {
  const queryClient = useQueryClient();
  const draftStorageKey = "mmt-connect-business-profile-draft";
  const [form, setForm] = useState<BusinessProfileForm>(() => {
    const profileForm: BusinessProfileForm = {
      legalName: initialProfile?.legalName ?? "",
      publicName: initialProfile?.publicName ?? "",
      country: initialProfile?.country ?? "",
      city: initialProfile?.city ?? "",
      contactName: initialProfile?.contactName ?? "",
      phone: initialProfile?.phone ?? "",
      email: initialProfile?.email ?? "",
      registrationNumber: initialProfile?.registrationNumber ?? "",
      businessType: initialProfile?.businessType ?? "",
      field: initialProfile?.field ?? "",
      roles: initialProfile?.roles ?? [],
      website: initialProfile?.website ?? "",
    };

    if (initialProfile || typeof window === "undefined") {
      return profileForm;
    }

    try {
      const savedDraft = window.sessionStorage.getItem(draftStorageKey);
      return savedDraft
        ? { ...profileForm, ...(JSON.parse(savedDraft) as Partial<BusinessProfileForm>) }
        : profileForm;
    } catch {
      return profileForm;
    }
  });
  const [document, setDocument] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialProfile) return;
    try {
      window.sessionStorage.setItem(draftStorageKey, JSON.stringify(form));
    } catch {
      // If session storage is unavailable, the form still works normally.
    }
  }, [draftStorageKey, form, initialProfile]);

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!document) {
      setError("Vergi levhası veya ülkenizdeki eşdeğer resmi belgeyi yükleyin.");
      return;
    }

    setIsSubmitting(true);
    try {
      const contentType = document.type as DocumentContentType;
      const upload = await requestB2BBusinessVerificationUploadUrl({
        name: document.name,
        size: document.size,
        contentType,
      });
      const uploadResponse = await fetch(upload.uploadURL, {
        method: "PUT",
        headers: { "Content-Type": document.type },
        body: document,
      });
      if (!uploadResponse.ok) {
        throw new Error("Belge yüklenemedi.");
      }

      const input: B2BBusinessProfileInput = {
        legalName: form.legalName.trim(),
        publicName: form.publicName.trim(),
        country: form.country.trim(),
        city: form.city.trim() || undefined,
        contactName: form.contactName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        registrationNumber: form.registrationNumber.trim(),
        businessType: form.businessType.trim(),
        field: form.field.trim(),
        roles: form.roles,
        website: form.website.trim() || undefined,
        contact: `${form.email.trim()} · ${form.phone.trim()}`,
        verificationDocument: {
          objectPath: upload.objectPath,
          fileName: document.name,
          contentType,
          size: document.size,
        },
      };
      await createMyB2BBusinessProfile(input);
      try {
        window.sessionStorage.removeItem(draftStorageKey);
      } catch {
        // The submitted profile is already stored on the server.
      }
      await queryClient.invalidateQueries({
        queryKey: getGetMyB2BBusinessProfileQueryKey(),
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Başvuru gönderilemedi. Bilgilerinizi kontrol edip tekrar deneyin.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
      <aside>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Tek seferlik doğrulama
        </p>
        <h2 className="mt-5 text-3xl font-semibold leading-tight md:text-4xl">
          Gerçek işletmeler,
          <span className="block font-serif font-normal italic text-primary">
            güçlü bağlantılar.
          </span>
        </h2>
        <div className="mt-8 space-y-5 text-sm leading-relaxed text-foreground/65">
          <p>
            Firma bilgilerinizi ve resmi belgenizi bir kez gönderin. MMT Global
            ekibi kontrol ettikten sonra her ilanınız doğrudan yayınlanır.
          </p>
          <p>
            Belgeniz public gösterilmez. İlanlarda yalnızca doğrulanmış işletme
            işareti, sizin seçtiğiniz iletişim bilgileri ve bağlantılar görünür.
          </p>
        </div>
        <div className="mt-8 space-y-4 border-l-2 border-primary pl-4 text-sm">
          <p className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Ücretsiz profil ve ilan yayınlama
          </p>
          <p className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Uluslararası ülke ve faaliyet alanı desteği
          </p>
          <p className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Web sitesi ve medya kanallarınıza trafik
          </p>
        </div>
      </aside>

      <form
        onSubmit={handleSubmit}
        className="border border-border/70 bg-card p-6 md:p-10"
      >
        <div className="mb-8 flex items-center gap-3 border-b border-border/70 pb-6">
          <FileCheck2 className="h-6 w-6 text-primary" />
          <div>
            <h3 className="font-semibold">İşletme doğrulama profili</h3>
            <p className="text-xs text-foreground/55">
              Bilgileriniz yalnızca doğrulama ve iletişim için kullanılır. Bu
              sekmede geri dönerseniz yazılı alanlarınız korunur; resmi belgeyi
              yeniden seçmeniz gerekebilir.
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Firma adı / yasal unvan" value={form.legalName} onChange={(v) => updateField("legalName", v)} required />
          <Field label="Yayınlanacak firma adı" value={form.publicName} onChange={(v) => updateField("publicName", v)} required />
          <Field label="Ülke" value={form.country} onChange={(v) => updateField("country", v)} required placeholder="Türkiye, Birleşik Krallık..." />
          <Field label="Şehir" value={form.city} onChange={(v) => updateField("city", v)} required placeholder="İstanbul, Erbil..." />
          <Field label="Yetkili adı soyadı" value={form.contactName} onChange={(v) => updateField("contactName", v)} required />
          <Field label="Telefon" value={form.phone} onChange={(v) => updateField("phone", v)} required placeholder="+90 ..." />
          <Field label="E-posta" type="email" value={form.email} onChange={(v) => updateField("email", v)} required />
          <Field label="Vergi / şirket kayıt numarası" value={form.registrationNumber} onChange={(v) => updateField("registrationNumber", v)} required />
          <Field label="İşletme türü" value={form.businessType} onChange={(v) => updateField("businessType", v)} required placeholder="Üretici, fabrika, esnaf..." />
          <Field label="Faaliyet alanı" value={form.field} onChange={(v) => updateField("field", v)} required placeholder="Tekstil, gıda, lojistik..." />
          <Field label="Web sitesi" value={form.website} onChange={(v) => updateField("website", v)} placeholder="https://" />
        </div>

        <fieldset className="mt-6">
          <legend className="mb-3 text-sm text-foreground/70">
            Firma rolü <span className="text-primary">*</span>
          </legend>
          <p className="mb-3 text-xs text-foreground/50">
            Firmanızın MMT Connect’te hangi alanlarda görünmesini istediğinizi seçin.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {businessRoleOptions.map(([value, label]) => {
              const selected = form.roles.includes(value);
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 border p-4 text-sm font-semibold transition-colors ${
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/70 hover:border-primary/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        roles: selected
                          ? current.roles.filter((role) => role !== value)
                          : [...current.roles, value],
                      }))
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="mt-6 block">
          <span className="mb-2 block text-sm text-foreground/70">
            Vergi levhası veya eşdeğer resmi belge <span className="text-primary">*</span>
          </span>
          <span className="flex cursor-pointer items-center gap-3 border border-dashed border-border/80 bg-background px-4 py-4 text-sm transition-colors hover:border-primary">
            <Upload className="h-5 w-5 text-primary" />
            <span className="min-w-0 flex-1 truncate">
              {document?.name ?? "PDF, JPG veya PNG — en fazla 10 MB"}
            </span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              onChange={(event) => setDocument(event.target.files?.[0] ?? null)}
            />
          </span>
        </label>

        {error ? (
          <p className="mt-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-8 flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90 disabled:opacity-70"
        >
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
          {isSubmitting ? "Gönderiliyor..." : "Doğrulama için gönder"}
        </button>
      </form>
    </div>
  );
}

function ProfileStatus({ profile }: { profile: B2BBusinessProfile }) {
  const copy = statusCopy[profile.status];
  return (
    <div className="mx-auto max-w-3xl border border-primary/30 bg-primary/5 p-8 md:p-12">
      <CheckCircle2 className="h-12 w-12 text-primary" />
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        {profile.publicName}
      </p>
      <h2 className="mt-3 text-3xl font-semibold">{copy.title}</h2>
      <p className="mt-4 max-w-2xl leading-relaxed text-foreground/65">
        {copy.description}
      </p>
      {profile.internalNote ? (
        <p className="mt-6 border-l-2 border-primary pl-4 text-sm text-foreground/70">
          MMT Global notu: {profile.internalNote}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/b2b-agi"
          className="bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white"
        >
          B2B ağını keşfet
        </Link>
        {profile.status === "verified" ? (
          <Link
            href="/b2b-agi"
            className="border border-border/70 px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:border-primary hover:text-primary"
          >
            Yeni ilan yayınla
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function VerifiedPublisher({ profile }: { profile: B2BBusinessProfile }) {
  const queryClient = useQueryClient();
  const draftStorageKey = `mmt-connect-listing-draft:${profile.id}`;
  const [savedDraft] = useState<Partial<ListingDraft>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.sessionStorage.getItem(draftStorageKey);
      return stored ? (JSON.parse(stored) as Partial<ListingDraft>) : {};
    } catch {
      return {};
    }
  });
  const [role, setRole] = useState<B2BListingRole>(
    savedDraft.role ?? "producer",
  );
  const [title, setTitle] = useState(savedDraft.title ?? "");
  const [fullName, setFullName] = useState(savedDraft.fullName ?? "");
  const [location, setLocation] = useState(savedDraft.location ?? "");
  const contact = profile.contact;
  const [description, setDescription] = useState(savedDraft.description ?? "");
  const [employmentType, setEmploymentType] =
    useState<B2BEmploymentType>(savedDraft.employmentType ?? "full_time");
  const [salary, setSalary] = useState(savedDraft.salary ?? "");
  const [experience, setExperience] = useState(savedDraft.experience ?? "");
  const website = profile.website ?? "";
  const [socials, setSocials] = useState<ListingSocials>({
    ...emptyListingSocials,
    ...savedDraft.socials,
  });
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [submittedListing, setSubmittedListing] = useState<B2BListing | null>(
    null,
  );

  useEffect(() => {
    if (!image) {
      setImagePreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(image);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [image]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          role,
          title,
          fullName,
          location,
          description,
          employmentType,
          salary,
          experience,
          socials,
        } satisfies ListingDraft),
      );
    } catch {
      // If session storage is unavailable, the form still works normally.
    }
  }, [
    draftStorageKey,
    role,
    title,
    fullName,
    location,
    description,
    employmentType,
    salary,
    experience,
    socials,
  ]);

  const createListing = useCreateB2BListing({
    mutation: {
      onSuccess: async (listing) => {
        setSubmittedListing(listing);
        try {
          window.sessionStorage.removeItem(draftStorageKey);
        } catch {
          // The submitted listing is already stored on the server.
        }
        await queryClient.invalidateQueries({
          queryKey: getGetB2BListingsQueryKey(),
        });
      },
    },
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImageError("");
    const cleanedSocials = {
      instagram: socials.instagram.trim() || undefined,
      facebook: socials.facebook.trim() || undefined,
      linkedin: socials.linkedin.trim() || undefined,
      telegram: socials.telegram.trim() || undefined,
      tiktok: socials.tiktok.trim() || undefined,
    };
    const hasSocials = Object.values(cleanedSocials).some(Boolean);

    try {
      let imageObjectPath: string | undefined;
      if (image) {
        const upload = await requestB2BListingImageUploadUrl({
          name: image.name,
          size: image.size,
          contentType: image.type as "image/jpeg" | "image/png",
        });
        const uploadResponse = await fetch(upload.uploadURL, {
          method: "PUT",
          headers: { "Content-Type": image.type },
          body: image,
        });
        if (!uploadResponse.ok) {
          throw new Error("İlan görseli yüklenemedi.");
        }
        imageObjectPath = upload.objectPath;
      }

      createListing.mutate({
        data: {
          role,
          title: title.trim(),
          fullName: fullName.trim(),
          organization: profile.publicName,
          location: location.trim(),
          contact: contact.trim(),
          description: description.trim(),
          imageObjectPath,
          employmentType: role === "employer" ? employmentType : undefined,
          salary: role === "employer" ? salary.trim() || undefined : undefined,
          experience: role === "employer" ? experience.trim() || undefined : undefined,
          website: website.trim() || undefined,
          socialLinks: hasSocials ? cleanedSocials : undefined,
        },
      });
    } catch (error) {
      setImageError(
        error instanceof Error
          ? error.message
          : "İlan görseli yüklenemedi. Lütfen tekrar deneyin.",
      );
    }
  }

  if (submittedListing) {
    return (
      <div className="mx-auto max-w-3xl border border-primary/30 bg-primary/5 p-8 md:p-12">
        <CheckCircle2 className="h-12 w-12 text-primary" />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {profile.publicName}
        </p>
        <h2 className="mt-3 text-3xl font-semibold">İlanınız incelemeye alındı</h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-foreground/65">
          İçeriğiniz MMT Global ekibi tarafından kontrol edilecek. Onaylandıktan
          sonra MMT Connect ağında herkese açık olarak yayınlanacak.
        </p>
        <div className="mt-6 border border-border/70 bg-card px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Referans kodu
          </p>
          <p className="mt-1 font-mono text-lg font-bold tracking-wider">
            {submittedListing.referenceCode}
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/b2b-agi"
            className="bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white"
          >
            Ağa dön
          </Link>
          <button
            type="button"
            onClick={() => {
              setSubmittedListing(null);
              setTitle("");
              setDescription("");
               setImage(null);
               setImageError("");
            }}
            className="border border-border/70 px-6 py-3 text-sm font-semibold uppercase tracking-wider hover:border-primary hover:text-primary"
          >
            Yeni ilan yayınla
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
      <aside>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Doğrulanmış işletme
        </p>
        <h2 className="mt-5 text-3xl font-semibold leading-tight md:text-4xl">
          {profile.publicName}
          <span className="block font-serif font-normal italic text-primary">
            artık yayında.
          </span>
        </h2>
        <p className="mt-8 leading-relaxed text-foreground/65">
          Ürün ilanı, satın alma talebi, lojistik, hizmet veya iş ilanınızı
          oluşturun.
          İlanınız MMT Global ekibinin kontrolünden sonra yayınlanır.
        </p>
        <div className="mt-8 border-l-2 border-primary pl-4 text-sm leading-relaxed text-foreground/70">
          <strong className="block text-foreground">Ücretsiz görünürlük</strong>
          Web sitenizi ve sosyal medya kanallarınızı ekleyerek ağ trafiğini
          kendi kanallarınıza yönlendirin.
        </div>
      </aside>

      <form
        onSubmit={handleSubmit}
        className="border border-border/70 bg-card p-6 md:p-10"
      >
        <div className="mb-8 border-b border-border/70 pb-6">
          <h3 className="text-2xl font-semibold">Yeni ilan gönder</h3>
          <p className="mt-2 text-sm text-foreground/55">
            İlanınız doğrulanmış işletme profilinizle MMT Global incelemesine gönderilir.
          </p>
        </div>

        <div>
          <label className="mb-3 block text-sm font-semibold">İlan türü</label>
           <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["producer", "Üretici"],
                ["buyer", "Alıcı"],
                ["logistics", "Lojistik / Hizmet"],
                 ["employer", "İşveren / İş ilanı"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`border p-4 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  role === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/70 text-foreground/60 hover:border-primary/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <Field
            label="İlan başlığı"
            value={title}
            onChange={setTitle}
            required
             placeholder={role === "employer" ? "Örn: Mermer ustası aranıyor" : "Örn: Pamuk ipliği tedariki"}
          />
          <Field
            label="Yetkili kişi"
            value={fullName}
            onChange={setFullName}
            required
          />
          <Field
            label="Şehir / ülke"
            value={location}
            onChange={setLocation}
            required
          />
          <Field
            label="İletişim"
            value={contact}
            required
            readOnly
          />
          <Field
            label="Web sitesi"
            value={website}
            placeholder="https://"
            readOnly
          />
        </div>
        <p className="mt-3 text-xs text-foreground/45">
          Web sitesi ve iletişim bilgisi doğrulanmış işletme profilinizden alınır.
        </p>
        {role === "employer" ? (
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Çalışma şekli
              <select
                value={employmentType}
                onChange={(event) =>
                  setEmploymentType(event.target.value as B2BEmploymentType)
                }
                className="h-12 border border-border/70 bg-background px-4 text-sm font-normal outline-none focus:border-primary"
              >
                {Object.entries(employmentTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <Field label="Ücret / maaş" value={salary} onChange={setSalary} placeholder="Örn. 35.000 TL" />
            <Field label="Deneyim şartı" value={experience} onChange={setExperience} placeholder="Örn. 2 yıl" />
          </div>
        ) : null}

        <label className="mt-6 block text-sm">
          <span className="mb-2 block text-foreground/70">
            İlan görseli <span className="text-foreground/45">(isteğe bağlı)</span>
          </span>
          <span className="flex cursor-pointer items-center gap-3 border border-dashed border-border/80 bg-background px-4 py-4 transition-colors hover:border-primary">
            <Upload className="h-5 w-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm">
              {image?.name ?? "JPG veya PNG — en fazla 5 MB"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (file && file.size > 5 * 1024 * 1024) {
                  setImage(null);
                  setImageError("Görsel en fazla 5 MB olabilir.");
                  return;
                }
                setImage(file);
              }}
            />
          </span>
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="İlan görseli önizleme"
              className="mt-3 aspect-[16/7] w-full object-cover"
            />
          ) : null}
        </label>

        <label className="mt-6 block text-sm">
          <span className="mb-2 block text-foreground/70">
            Açıklama <span className="text-primary">*</span>
          </span>
          <textarea
            required
            minLength={20}
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
             placeholder={role === "employer" ? "Pozisyon, görevler, deneyim şartı, çalışma şekli ve ücret bilgisini yazın..." : "Ürününüzü, arayışınızı veya hizmet detaylarınızı yazın..."}
            className="w-full resize-y border border-border/70 bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </label>

        {imageError ? (
          <p className="mt-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {imageError}
          </p>
        ) : null}

        <div className="mt-7 border-t border-border/70 pt-7">
          <h4 className="mb-4 text-sm font-semibold">Medya kanalları</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="LinkedIn" value={socials.linkedin} onChange={(v) => setSocials({ ...socials, linkedin: v })} placeholder="Profil URL'si" />
            <Field label="Instagram" value={socials.instagram} onChange={(v) => setSocials({ ...socials, instagram: v })} placeholder="Profil URL'si" />
            <Field label="Facebook" value={socials.facebook} onChange={(v) => setSocials({ ...socials, facebook: v })} placeholder="Profil URL'si" />
            <Field label="Telegram" value={socials.telegram} onChange={(v) => setSocials({ ...socials, telegram: v })} placeholder="t.me/kullaniciadi" />
            <Field label="TikTok" value={socials.tiktok} onChange={(v) => setSocials({ ...socials, tiktok: v })} placeholder="Profil URL'si" />
          </div>
        </div>

        {createListing.isError ? (
          <div className="mt-6 flex gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            İlan yayınlanamadı. Bilgilerinizi kontrol edip tekrar deneyin.
          </div>
        ) : null}

        <button
          type="submit"
          disabled={createListing.isPending}
          className="mt-7 flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90 disabled:opacity-70"
        >
          {createListing.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : null}
           İlanı incelemeye gönder
        </button>
      </form>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-56 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  placeholder,
  readOnly = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  type?: "text" | "email";
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block text-foreground/70">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
        required={required}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`w-full border border-border/70 bg-background px-4 py-3 outline-none transition-colors focus:border-primary ${
          readOnly ? "cursor-default text-foreground/65" : ""
        }`}
      />
    </label>
  );
}