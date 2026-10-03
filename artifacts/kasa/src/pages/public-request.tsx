import { useParams } from 'wouter';
import { getGetKasaPublicRequestQueryKey, useGetKasaPublicRequest } from '@workspace/api-client-react';
import { ErrorBox, Logo, Skeleton, StatusBadge } from '@/components/kit';
import { errMsg, errStatus, money } from '@/lib/format';

export default function PublicRequestPage() {
  const { reference = '' } = useParams<{ reference: string }>();
  const q = useGetKasaPublicRequest(reference, {
    query: {
      queryKey: getGetKasaPublicRequestQueryKey(reference),
      refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? 20000 : false),
    },
  });
  const r = q.data;
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-4 py-10">
      <title>Ödeme talebi | MMT Kasa</title>
      <Logo />
      <div className="rise w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-[6px_6px_0_hsl(var(--border))]">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ödeme talebi</p>
        {q.isLoading ? (
          <div className="mt-4 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-6 w-1/3" /></div>
        ) : q.isError ? (
          <div className="mt-4">
            <ErrorBox message={errStatus(q.error) === 404 ? 'Bu referansla bir talep bulunamadı.' : errMsg(q.error)} onRetry={() => q.refetch()} />
          </div>
        ) : r?.status === 'CANCELLED' ? (
          <div className="mt-4" role="status" data-testid="public-cancelled">
            <StatusBadge status="CANCELLED" />
            <p className="mt-3 text-sm">Bu talep iptal edildi. Bu QR bağlantısı üzerinden ödeme yapılamaz.</p>
          </div>
        ) : r ? (
          <>
            <div className="num mt-3 text-4xl font-semibold" data-testid="text-public-amount">{money(r.amount, r.currency)}</div>
            <div className="mt-3"><StatusBadge status={r.status} /></div>
            <button disabled className="mt-6 w-full cursor-not-allowed rounded-md bg-muted px-4 py-3 text-sm font-bold text-muted-foreground" data-testid="button-pay-disabled">
              Ödeme şu an kapalı
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Canlı ödeme etkin değildir. Bu sayfa yalnızca talebin tutarını ve durumunu gösterir.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
