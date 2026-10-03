import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetKasaServiceInvoicesQueryKey,
  getGetTamiPaymentRefundsQueryKey,
  useCancelKasaServiceInvoice,
  useCreateKasaServiceInvoice,
  useCreateTamiPaymentRefund,
  useGetKasaServiceInvoices,
  useGetTamiPaymentRefunds,
  useReconcileTamiPayment,
  type ServiceInvoice,
} from '@workspace/api-client-react';
import { ExternalLink, FileText, RotateCcw } from 'lucide-react';
import { EmptyState, ErrorBox, ListSkeleton, Notice, PageHeader, btn, btnDanger, btnSecondary, inputCls, labelCls } from '@/components/kit';
import { dateTime, errMsg, money } from '@/lib/format';

const currencies = ['TRY', 'EUR', 'USD'] as const;

function invoiceStatus(invoice: ServiceInvoice) {
  if (invoice.status === 'issued' && invoice.paymentStatus === 'pending') return 'Ödeme işlemi sürüyor';
  if (invoice.status === 'issued' && invoice.paymentStatus === 'failed') return 'Son ödeme başarısız';
  if (invoice.status === 'issued' && invoice.paymentStatus === 'cancelled') return 'Ödeme iptal edildi';
  return {
    issued: 'Ödeme bekliyor',
    paid: 'Ödendi',
    partially_refunded: 'Kısmen iade edildi',
    refunded: 'İade edildi',
    cancelled: 'İptal edildi',
  }[invoice.status];
}

function InvoiceRow({ invoice, onRefresh }: { invoice: ServiceInvoice; onRefresh: () => void }) {
  const qc = useQueryClient();
  const orderId = invoice.paymentReference ?? '';
  const refunds = useGetTamiPaymentRefunds(orderId, {
    query: {
      queryKey: getGetTamiPaymentRefundsQueryKey(orderId),
      enabled: Boolean(orderId),
      staleTime: 0,
      refetchOnMount: 'always',
    },
  });
  const cancel = useCancelKasaServiceInvoice();
  const refund = useCreateTamiPaymentRefund();
  const reconcile = useReconcileTamiPayment();
  const [refundAmount, setRefundAmount] = useState(invoice.amount);
  const [reason, setReason] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const remaining = useMemo(() => {
    const toCents = (value: string) => {
      const [whole = '0', fraction = ''] = value.split('.');
      return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
    };
    const cents = toCents(invoice.amount) - toCents(invoice.refundedAmount);
    return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
  }, [invoice.amount, invoice.refundedAmount]);
  const hasPendingRefund = refunds.data?.some((item) => item.status === 'pending') ?? false;
  const paymentLink = `${window.location.origin}/odeme?invoice=${encodeURIComponent(invoice.reference)}`;

  useEffect(() => {
    setRefundAmount(remaining);
  }, [remaining]);

  function refresh() {
    onRefresh();
    if (orderId) qc.invalidateQueries({ queryKey: getGetTamiPaymentRefundsQueryKey(orderId) });
  }

  return (
    <li className="space-y-4 px-4 py-4 sm:px-5" data-testid={`row-service-invoice-${invoice.id}`}>
      <div className="flex flex-wrap items-start gap-3">
        <FileText className="mt-1 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold">{invoice.reference}</span>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{invoiceStatus(invoice)}</span>
          </div>
          <p className="mt-1 break-words text-sm">{invoice.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Düzenlendi: {dateTime(invoice.issuedAt)} · İade: {money(invoice.refundedAmount, invoice.currency)}
            {invoice.paidAt ? ` · Ödendi: ${dateTime(invoice.paidAt)}` : ''}
          </p>
          <p className="mt-2 num text-lg font-bold">{money(invoice.amount, invoice.currency)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {invoice.status === 'issued' && invoice.paymentStatus !== 'pending' && (
            <>
              <a className={btnSecondary} href={paymentLink} target="_blank" rel="noreferrer" data-testid={`link-service-invoice-${invoice.id}`}>
                <ExternalLink className="h-3.5 w-3.5" /> Ödeme bağlantısı
              </a>
              <button
                type="button"
                className={btnDanger}
                onClick={() => {
                  if (window.confirm('Bu ödenmemiş faturayı iptal edilsin mi? Kayıt korunur.')) {
                    cancel.mutate({ id: invoice.id }, { onSuccess: refresh });
                  }
                }}
                disabled={cancel.isPending}
                data-testid={`button-cancel-service-invoice-${invoice.id}`}
              >
                Faturayı iptal et
              </button>
            </>
          )}
        </div>
      </div>

      {orderId && (invoice.status === 'paid' || invoice.status === 'partially_refunded' || invoice.status === 'refunded') && (
        <div className="ml-8 space-y-3 border-l-2 border-border pl-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Ödeme kaydı: <span className="font-mono">{orderId}</span></p>
            {hasPendingRefund && (
              <button
                type="button"
                className={btnSecondary}
                disabled={reconcile.isPending}
                onClick={() => reconcile.mutate({ orderId }, { onSuccess: refresh })}
                data-testid={`button-reconcile-refund-${invoice.id}`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {reconcile.isPending ? 'Mutabakat yapılıyor…' : 'İadeyi mutabık kıl'}
              </button>
            )}
          </div>
          {refunds.isError && <ErrorBox message={errMsg(refunds.error)} onRetry={() => refunds.refetch()} />}
          {refunds.data?.length ? (
            <ul className="space-y-1 text-xs" data-testid={`list-refunds-${invoice.id}`}>
              {refunds.data.map((item) => (
                <li key={item.id} className="flex flex-wrap justify-between gap-2">
                  <span>{money(item.amount, item.currency)} · {item.status === 'success' ? 'İade edildi' : item.status === 'pending' ? 'Mutabakat bekliyor' : 'Sağlayıcı reddetti'}</span>
                  <span className="text-muted-foreground">{dateTime(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {(invoice.status === 'paid' || invoice.status === 'partially_refunded') && (
            <form
              className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                refund.mutate(
                  {
                    orderId,
                    data: {
                      amount: refundAmount.trim().replace(',', '.'),
                      reason: reason.trim(),
                      idempotencyKey,
                    },
                  },
                  {
                    onSuccess: () => {
                      setIdempotencyKey(crypto.randomUUID());
                      setReason('');
                      refresh();
                    },
                    onError: refresh,
                  },
                );
              }}
            >
              <label>
                <span className={labelCls}>İade tutarı · kalan {money(remaining, invoice.currency)}</span>
                <input
                  className={inputCls}
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  inputMode="decimal"
                  pattern="[0-9]+([.,][0-9]{1,2})?"
                  required
                  data-testid={`input-refund-amount-${invoice.id}`}
                />
              </label>
              <label>
                <span className={labelCls}>İade nedeni</span>
                <input
                  className={inputCls}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={2}
                  maxLength={150}
                  required
                  data-testid={`input-refund-reason-${invoice.id}`}
                />
              </label>
              <button className={btn} disabled={refund.isPending || hasPendingRefund || remaining === '0.00'} data-testid={`button-refund-${invoice.id}`}>
                {refund.isPending ? 'Gönderiliyor…' : 'İade başlat'}
              </button>
              {refund.isError && <div className="sm:col-span-3"><ErrorBox message={errMsg(refund.error)} /></div>}
              {reconcile.isError && <div className="sm:col-span-3"><ErrorBox message={errMsg(reconcile.error)} /></div>}
              {hasPendingRefund && <p className="text-xs text-pending sm:col-span-3">Yeni iade göndermeden önce bekleyen işlem için sağlayıcı mutabakatı yapın.</p>}
            </form>
          )}
        </div>
      )}

      {invoice.status === 'issued' && orderId && invoice.paymentStatus === 'pending' && (
        <div className="ml-8 space-y-2 border-l-2 border-border pl-4">
          <p className="text-xs text-muted-foreground">Ödeme sonucu henüz sağlayıcıdan doğrulanmadı.</p>
          <button
            type="button"
            className={btnSecondary}
            disabled={reconcile.isPending}
            onClick={() => reconcile.mutate({ orderId }, { onSuccess: onRefresh })}
            data-testid={`button-reconcile-payment-${invoice.id}`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {reconcile.isPending ? 'Ödeme kontrol ediliyor…' : 'Ödemeyi sağlayıcıda kontrol et'}
          </button>
          {reconcile.isError && <ErrorBox message={errMsg(reconcile.error)} />}
        </div>
      )}
    </li>
  );
}

export default function ServiceInvoicesPage() {
  const qc = useQueryClient();
  const invoices = useGetKasaServiceInvoices({
    query: { queryKey: getGetKasaServiceInvoicesQueryKey(), staleTime: 0, refetchOnMount: 'always' },
  });
  const create = useCreateKasaServiceInvoice();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<(typeof currencies)[number]>('TRY');
  const [description, setDescription] = useState('');

  function refresh() {
    qc.invalidateQueries({ queryKey: getGetKasaServiceInvoicesQueryKey() });
  }

  return (
    <>
      <title>Hizmet faturaları | MMT Kasa</title>
      <PageHeader title="Hizmet faturaları" sub="Bu kalıcı kayıt yalnızca MMT Global hizmetleri içindir; inşaat mağazasının Shopify ödemelerinden ayrıdır." />
      <Notice tone="warn">
        Canlı tahsilat kapalıdır. Yalnızca yazılı şirket/sağlayıcı yetkisi, banka onayı, sağlayıcı tarafından doğrulanmış 3D Secure ve başarılı testler sunucuya kaydedildiğinde açılabilir.
      </Notice>
      <form
        className="mt-5 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_auto_1.5fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate(
            { data: { amount: amount.trim().replace(',', '.'), currency, description: description.trim() } },
            {
              onSuccess: () => {
                setAmount('');
                setDescription('');
                refresh();
              },
            },
          );
        }}
      >
        <label>
          <span className={labelCls}>Tutar</span>
          <input
            className={inputCls}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            pattern="[0-9]+([.,][0-9]{1,2})?"
            placeholder="0,00"
            required
            data-testid="input-service-invoice-amount"
          />
        </label>
        <label>
          <span className={labelCls}>Para birimi</span>
          <select className={inputCls} value={currency} onChange={(event) => setCurrency(event.target.value as (typeof currencies)[number])} data-testid="select-service-invoice-currency">
            {currencies.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span className={labelCls}>Hizmet açıklaması</span>
          <input
            className={inputCls}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            minLength={2}
            maxLength={240}
            required
            data-testid="input-service-invoice-description"
          />
        </label>
        <button className={`${btn} self-end`} disabled={create.isPending} data-testid="button-create-service-invoice">
          {create.isPending ? 'Düzenleniyor…' : 'Fatura düzenle'}
        </button>
        {create.isError && <div className="sm:col-span-4"><ErrorBox message={errMsg(create.error)} /></div>}
      </form>
      <section className="mt-6">
        {invoices.isLoading ? <ListSkeleton /> : invoices.isError ? (
          <ErrorBox message={errMsg(invoices.error)} onRetry={() => invoices.refetch()} />
        ) : !invoices.data?.length ? (
          <EmptyState title="Henüz hizmet faturası yok" text="Yeni fatura ekleyin. Sistem güvenli, rastgele bir ödeme referansı üretir; bu kayıtlar kasa taleplerinden ayrıdır." />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card" data-testid="list-service-invoices">
            {invoices.data.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} onRefresh={refresh} />
            ))}
          </ul>
        )}
      </section>
      <p className="mt-6 text-xs text-muted-foreground">
        MMT Kasa paneline dönmek için <Link href="/panel" className="font-semibold underline">buraya tıklayın</Link>.
      </p>
    </>
  );
}