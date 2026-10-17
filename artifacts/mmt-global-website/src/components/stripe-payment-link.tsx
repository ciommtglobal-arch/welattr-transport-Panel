import { ExternalLink, ShieldCheck } from "lucide-react";

// Public, merchant-authorized hosted checkout URL, not an API credential.
// No invoice IDs, customer details or success claims are appended to this link.
export const STRIPE_SERVICE_PAYMENT_URL =
  "https://buy.stripe.com/aFaaEY6z5bcsfbN2yz9EI00";

export function StripeServicePaymentLink() {
  // Account/link authorization is not permission to publish this option.
  // An unrelated future production build must not silently activate it.
  if (!import.meta.env.DEV) return null;

  return (
    <section
      aria-labelledby="stripe-service-payment-title"
      className="border-b border-border/70 px-6 py-10 md:px-12"
      data-testid="stripe-service-payment"
    >
      <div className="mx-auto max-w-7xl border border-primary/30 bg-primary/5 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              Önizleme · Canlı harici Stripe bağlantısı
            </p>
            <h2 id="stripe-service-payment-title" className="mt-3 text-2xl font-semibold">
              100 USD hizmet bedeli
            </h2>
            <p className="mt-3 text-sm leading-6 text-foreground/75">
              Ödeme sayfasında görünen alıcı: <strong>Parlar Global LLC</strong>.
              Vergi varsa son toplam Stripe ekranında gösterilir.
            </p>
            <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-foreground/65">
              <ShieldCheck size={18} className="mt-1 shrink-0 text-primary" aria-hidden="true" />
              Kart bilgileri Stripe üzerinde girilir; MMT Global tarafından alınmaz.
            </p>
          </div>
          <a
            href={STRIPE_SERVICE_PAYMENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-describedby="stripe-service-payment-warning"
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-primary px-6 py-3 text-center text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            data-testid="stripe-service-payment-link"
          >
            Stripe ödeme sayfasını aç
            <ExternalLink size={16} aria-hidden="true" />
            <span className="sr-only">(yeni sekme)</span>
          </a>
        </div>
        <div
          id="stripe-service-payment-warning"
          className="mt-6 border-t border-primary/20 pt-4 text-sm leading-6 text-foreground/75"
        >
          <p><strong>Bu bir test ödeme sayfası değildir.</strong> Gerçek kartla ödeme yaparsanız gerçek tahsilat oluşabilir.</p>
          <p className="mt-2">
            Bu seçenek yalnız kararlaştırılmış 100 USD hizmet bedeli içindir.
            Tami faturası veya Shopify siparişi için alternatif ödeme değildir;
            aynı işlem için tekrar ödeme yapmayın.
          </p>
          <p className="mt-2">
            Linke gitmek ya da geri dönmek, MMT Connect faturalarını otomatik
            “ödendi” yapmaz. Ödeme ve fatura eşleştirmesi ayrıca doğrulanmalıdır.
          </p>
        </div>
      </div>
    </section>
  );
}
