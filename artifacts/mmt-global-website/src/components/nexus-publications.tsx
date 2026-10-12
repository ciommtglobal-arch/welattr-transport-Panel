import { useGetPublicNexusPublications, getGetPublicNexusPublicationsQueryKey, type PublicNexusPublication } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { nexusCopy } from "@/lib/nexus-copy";

export function NexusPublicationCards({ records }: { records: PublicNexusPublication[] }) {
  const { locale } = useI18n();
  const copy = nexusCopy[locale];
  return records.length ? <ul className="mt-5 grid gap-4 sm:grid-cols-2">
    {records.map(row => <li key={row.id} data-testid={`nexus-publication-${row.id}`}
      className="rounded-xl border border-current/15 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">MMT Global · MMT Nexus</p>
      <h3 className="mt-2 text-lg font-semibold">{row.kind === "reservation" ? copy.reservation : copy.financing}</h3>
      <p className="mt-2 font-medium">{row.corridor}</p>
      <time className="mt-3 block text-xs opacity-60" dateTime={row.publishedAt}>
        {new Date(row.publishedAt).toLocaleDateString(locale)}
      </time>
    </li>)}
  </ul> : <p className="mt-5 text-sm opacity-70" data-testid="nexus-public-empty">{copy.publicEmpty}</p>;
}

export default function PublicNexusSection() {
  const { locale } = useI18n();
  const copy = nexusCopy[locale];
  const query = useGetPublicNexusPublications({ query: {
    queryKey: getGetPublicNexusPublicationsQueryKey(), staleTime: 0, refetchInterval: 30000, retry: false,
  } });
  return <section className="mt-12 border-t border-current/15 pt-8" aria-labelledby="public-nexus-title">
    <h2 id="public-nexus-title" className="text-xl font-semibold">{copy.publicTitle}</h2>
    <p className="mt-2 text-sm opacity-70">{copy.publicNote}</p>
    {query.isLoading ? <p role="status" className="mt-5">{copy.loading}</p> : query.isError
      ? <p role="status" className="mt-5 text-sm opacity-70">{copy.publicUnavailable}</p>
      : <NexusPublicationCards records={query.data ?? []} />}
  </section>;
}
