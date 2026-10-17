import { ExternalLink, ShieldCheck } from "lucide-react";

// Merchant-shared customer checkout URL, not an API credential.
// Never append invoice/customer data or use navigation as payment confirmation.
export const TAMI_HOSTED_PAYMENT_URL =
  "https://portal.tami.com.tr/paymentLink/8464fcf1-6216-4163-abff-760794b2c854";

export function TamiHostedPaymentLink() {
  // Sharing a live payment link is not consent to publish it.
  if (!import.meta.env.DEV) return null;

  return (
    <section
      aria-labelledby="tami-hosted-payment-title"
      className="border-b border-border/70 px-6 py-10 md:px-12"
      data-testid="tami-hosted-payment"
    >
      <div className="mx-auto max-w-7xl border border-primary/30 bg-primary/5 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              Yalnızca önizleme · Gerçek Tami bağlantısı
            </p>
            <h2 id="tami-hosted-payment-title" className="mt-3 text-2xl font-semibold">
              Mevcut Tami ödeme bağlantısı
            </h2>
            <p className="mt-3 text-sm leading-6 text-foreground/75">
              Kurucu, bu bağlantıyla daha önce ödeme aldığını bildirdi.
              Güncel tutar, para birimi, alıcı ve tekrar kullanılabilirlik burada
              doğrulanmadı; Tami ekranında kontrol edilmelidir.
            </p>
            <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-foreground/65">
              <ShieldCheck size={18} className="mt-1 shrink-0 text-primary" aria-hidden="true" />
              Kart bilgileri yalnızca Tami sayfasında girilir; MMT Global tarafından alınmaz.
            </p>
          </div>
          <a
            href={TAMI_HOSTED_PAYMENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-describedby="tami-hosted-payment-warning"
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-primary px-6 py-3 text-center text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            data-testid="tami-hosted-payment-link"
          >
            Tami bağlantısını incele
            <ExternalLink size={16} aria-hidden="true" />
            <span className="sr-only">(yeni sekme)</span>
          </a>
        </div>
        <div
          id="tami-hosted-payment-warning"
          className="mt-6 border-t border-primary/20 pt-4 text-sm leading-6 text-foreground/75"
        >
          <p>
            <strong>Bu bir demo ödeme değildir.</strong> Gerçek kartla ödeme
            yaparsanız gerçek tahsilat oluşabilir. Daha önce ödenmiş bir işlem
            için yeniden ödeme yapmayın.
          </p>
          <p className="mt-2">
            Bu bağlantı, MMT Connect faturası veya Shopify siparişinin yerine
            kullanılmaz. Sayfayı açmak ya da geri dönmek otomatik ödeme kaydı,
            fatura eşleştirmesi veya operasyon onayı oluşturmaz.
          </p>
          <p className="mt-2">
            Yabancı kart kabulü ve zorunlu 3DS bu bağlantı üzerinden doğrulanmadı.
          </p>
        </div>
      </div>
    </section>
  );
}
