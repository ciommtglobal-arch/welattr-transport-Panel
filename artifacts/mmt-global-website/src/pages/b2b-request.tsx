import { FormEvent, useState } from "react";
import { SignInButton, useAuth } from "@clerk/react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, Loader2, MessageSquareText } from "lucide-react";
import {
  useCreateB2BRequest,
  type B2BEmploymentType,
  type B2BRequestCategory,
} from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";

const categoryTranslationKeys: Record<B2BRequestCategory, string> = {
  product: "product_request",
  service: "service_request",
  logistics: "logistics_request",
  partnership: "partnership_request",
  employment: "job_request",
  other: "other",
};
const fieldClass =
  "h-12 border border-border bg-background px-3 text-sm font-normal outline-none focus:border-primary";
const employmentTranslationKeys: Record<B2BEmploymentType, string> = {
  full_time: "employment_full_time",
  part_time: "employment_part_time",
  contract: "employment_contract",
  seasonal: "employment_seasonal",
  internship: "employment_internship",
  remote: "employment_remote",
};

export default function B2BRequestPage() {
  const { t } = useI18n();
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
            <ArrowLeft size={15} /> {t("b2b_back")}
          </Link>
        </div>
      </header>

      <section className="border-b border-border/70 bg-secondary px-6 py-14 text-secondary-foreground md:px-12 md:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <MessageSquareText size={15} /> {t("request_kicker_form")}
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl">
            {t("request_hero_title")}
            <span className="block font-serif font-normal italic text-primary">
              {t("request_hero_emphasis")}
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70">
            {t("request_hero_description")}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12 md:px-12 md:py-16">
        {!isLoaded ? (
          <Loading />
        ) : !isSignedIn ? (
          <div className="border border-border bg-card p-8 text-center md:p-12">
            <h2 className="text-3xl font-semibold font-serif">
              {t("sign_in_to_request")}
            </h2>
            <p className="mx-auto mt-4 max-w-lg leading-relaxed text-foreground/60">
              {t("sign_in_to_request_description")}
            </p>
            <SignInButton mode="modal">
              <button className="mt-8 bg-primary px-7 py-4 text-sm font-semibold uppercase tracking-wider text-white">
                {t("sign_in")}
              </button>
            </SignInButton>
          </div>
        ) : submitted ? (
          <div className="border border-primary/30 bg-primary/5 p-8 md:p-12">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h2 className="mt-7 text-3xl font-semibold">
              {t("request_received")}
            </h2>
            <p className="mt-4 max-w-2xl leading-relaxed text-foreground/65">
              {t("request_received_description")}
            </p>
            <Link
              href="/b2b-agi"
              className="mt-8 inline-flex bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white"
            >
              {t("back_to_network")}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="border border-border bg-card p-6 md:p-10">
            <div className="grid gap-6 md:grid-cols-2">
              <Field label={t("request_type")}>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as B2BRequestCategory)}
                  className={fieldClass}
                >
                  {Object.entries(categoryTranslationKeys).map(([value, key]) => (
                    <option key={value} value={value}>{t(key)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("request_title_label")}>
                <input required minLength={5} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("request_title_label")} className={fieldClass} />
              </Field>
              <Field label={t("full_name")}>
                <input required minLength={2} maxLength={160} value={requesterName} onChange={(event) => setRequesterName(event.target.value)} className={fieldClass} />
              </Field>
              <Field label={t("organization_optional")}>
                <input maxLength={200} value={organization} onChange={(event) => setOrganization(event.target.value)} className={fieldClass} />
              </Field>
              <Field label={t("city_country")}>
                <input required minLength={2} maxLength={160} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Istanbul, Turkey" className={fieldClass} />
              </Field>
              <Field label={t("contact")}>
                <input required minLength={5} maxLength={180} value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Email or phone" className={fieldClass} />
              </Field>
              {category === "employment" ? (
                <>
                  <Field label={t("work_type")}>
                    <select
                      value={employmentType}
                      onChange={(event) =>
                        setEmploymentType(event.target.value as B2BEmploymentType)
                      }
                      className={fieldClass}
                    >
                      {Object.entries(employmentTranslationKeys).map(([value, key]) => (
                        <option key={value} value={value}>{t(key)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("salary_optional")}>
                    <input maxLength={120} value={salary} onChange={(event) => setSalary(event.target.value)} placeholder={t("salary_optional")} className={fieldClass} />
                  </Field>
                  <Field label={t("experience_optional")}>
                    <input maxLength={160} value={experience} onChange={(event) => setExperience(event.target.value)} placeholder={t("experience_optional")} className={fieldClass} />
                  </Field>
                </>
              ) : null}
            </div>
                <Field label={category === "employment" ? t("describe_job_seeker") : t("describe_need")}>
                  <textarea required minLength={20} maxLength={2000} rows={7} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={category === "employment" ? t("describe_job_seeker") : t("describe_need")} className={`${fieldClass} h-auto resize-y`} />
            </Field>
            {request.isError ? (
              <p className="mt-5 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
                {t("request_submit_error")}
              </p>
            ) : null}
            <button type="submit" disabled={request.isPending} className="mt-7 flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white disabled:opacity-60">
              {request.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              {request.isPending ? t("sending") : t("request_submit")}
            </button>
            <p className="mt-4 text-center text-xs leading-relaxed text-foreground/45">
              {t("request_review_note")}
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