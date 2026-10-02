import { useState } from 'react';
import { Link, useParams } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { getGetKasaRequestQueryKey, useGetKasaRequest } from '@workspace/api-client-react';
import { ErrorBox, Notice, Skeleton, StatusBadge, btnSecondary } from '@/components/kit';
import { useBranches } from '@/lib/branches';
import { dateTime, errMsg, errStatus, money } from '@/lib/format';

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const rid = Number(id);
  const b = useBranches();
  const [copied, setCopied] = useState(false);
  const q = useGetKasaRequest(rid, {
    query: {
      queryKey: getGetKasaRequestQueryKey(rid),
      enabled: Number.isInteger(rid) && rid > 0,
      refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? 20000 : false),
    },
  });
  const r = q.data;
  const url = r ? `${window.location.origin}/kasa/talep/${r.reference}` : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* pano erişimi yok */
    }
  };
  return (
    <>
      <title>Talep detayı | MMT Kasa</title>
      <Link href="/requests" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="link-back"><ArrowLeft className="h-4 w-4" />Talepler</Link>
      {q.isLoading ? <div className="space-y-3"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-64" /></div>
        : q.isError ? <ErrorBox message={[403, 404].includes(errStatus(q.error) ?? 0) ? 'Bu talebi görüntüleme yetkiniz yok ya da talep bulunamadı.' : errMsg(q.error)} onRetry={() => q.refetch()} />
        : r ? (
        <div className="rise grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="min-w-0 rounded-lg border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="num min-w-0 break-all text-sm font-semibold text-muted-foreground" data-testid="text-reference">{r.reference}</span><StatusBadge status={r.status} /></div>
            <div className="num mt-4 text-4xl font-semibold [overflow-wrap:anywhere] sm:text-5xl" data-testid="text-amount">{money(r.amount, r.currency)}</div>
            <dl className="mt-6 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4 border-t border-border pt-4 text-sm [overflow-wrap:anywhere]">
              <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Şube</dt><dd className="font-semibold">{b.name(r.branchId)}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Oluşturulma</dt><dd className="font-semibold">{dateTime(r.createdAt)}</dd></div>
              <div className="col-span-2"><dt className="text-xs uppercase tracking-wider text-muted-foreground">Not</dt><dd>{r.note || 'Not girilmemiş.'}</dd></div>
            </dl>
            <div className="mt-5">
              {r.status === 'PENDING'
                ? <Notice tone="warn">Bu talep henüz tahsil edilmedi; gelir olarak sayılmaz.</Notice>
                : <Notice>Bu talep tahsil edildi olarak kayıtlı.</Notice>}
            </div>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-card p-6 text-center">
            <div className="mx-auto w-fit rounded-md bg-white p-3" data-testid="qr-code"><QRCodeSVG value={url} size={176} level="M" fgColor="#12282c" bgColor="#ffffff" /></div>
            <p className="num mt-3 break-all text-xs text-muted-foreground" data-testid="text-qr-url">{url}</p>
            <button onClick={copy} className={`${btnSecondary} mt-3`} data-testid="button-copy-link">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Kopyalandı' : 'Bağlantıyı kopyala'}</button>
            <p className="mt-3 text-xs text-muted-foreground">QR sayfası yalnızca tutar ve durumu gösterir. Canlı ödeme kapalıdır.</p>
          </div>
        </div>) : null}
    </>
  );
}
