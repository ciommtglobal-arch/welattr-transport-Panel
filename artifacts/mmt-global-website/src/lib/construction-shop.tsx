import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, FileText, ShoppingBag } from "lucide-react";
import { useGetConstructionCart, getGetConstructionCartQueryKey } from "@workspace/api-client-react";
import { useI18n, type Locale } from "@/lib/i18n";
import { getLocaleCopy, type CoreLocale } from "@/lib/locale-copy";

const CART_KEY = "mezopotamya-build-cart-id";

/** Shopify cart IDs contain "/" and "?key=", so they must be encoded as a single path segment. */
export function encodeCartId(id: string) {
  return encodeURIComponent(id);
}

export function useCartId() {
  const [cartId, setState] = useState<string | null>(() => {
    try { return localStorage.getItem(CART_KEY); } catch { return null; }
  });
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === CART_KEY) setState(e.newValue); };
    const onLocal = () => { try { setState(localStorage.getItem(CART_KEY)); } catch { /* ignore */ } };
    window.addEventListener("storage", onStorage);
    window.addEventListener("mb-cart-change", onLocal);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("mb-cart-change", onLocal); };
  }, []);
  const setCartId = useCallback((id: string | null) => {
    try { if (id) localStorage.setItem(CART_KEY, id); else localStorage.removeItem(CART_KEY); } catch { /* ignore */ }
    setState(id);
    window.dispatchEvent(new Event("mb-cart-change"));
  }, []);
  return [cartId, setCartId] as const;
}

export function useConstructionCart() {
  const [cartId, setCartId] = useCartId();
  const encoded = cartId ? encodeCartId(cartId) : "";
  const query = useGetConstructionCart(encoded, {
    query: { enabled: Boolean(cartId), queryKey: getGetConstructionCartQueryKey(encoded), retry: false },
  });
  useEffect(() => {
    const status = (query.error as { status?: number } | null)?.status;
    if (status === 404) setCartId(null);
  }, [query.error, setCartId]);
  return { cartId, setCartId, encoded, query };
}

export function errorStatus(error: unknown) {
  return (error as { status?: number } | null)?.status;
}

export function formatMoney(amount: string | null | undefined, currency: string | null | undefined, locale: Locale) {
  if (amount == null || amount === "") return null;
  const n = Number(amount);
  if (!Number.isFinite(n) || !currency) return `${amount}${currency ? ` ${currency}` : ""}`;
  try {
    return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : locale === "ar" ? "ar" : locale === "ru" ? "ru-RU" : locale === "uk" ? "uk-UA" : locale === "ku" ? "ku" : "en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${amount} ${currency}`;
  }
}

type Copy = {
  back: string; store: string; cart: string; quote: string; by: string;
  disclaimer: string;
};
const shell: Record<CoreLocale, Copy> = {
  tr: { back: "MMT Global'e dön", store: "Mağaza", cart: "Sepet", quote: "Teklif iste", by: "by MMT Global", disclaimer: "Mezopotamya Build, MMT Global tarafından işletilen bağımsız bir satıcıdır. Yetkili distribütörlük iddiasında bulunmaz." },
  en: { back: "Back to MMT Global", store: "Store", cart: "Cart", quote: "Request quote", by: "by MMT Global", disclaimer: "Mezopotamya Build is an independent seller operated by MMT Global. It makes no authorized distributor claim." },
  ar: { back: "العودة إلى MMT Global", store: "المتجر", cart: "السلة", quote: "طلب عرض سعر", by: "من MMT Global", disclaimer: "Mezopotamya Build بائع مستقل تديره MMT Global، ولا يدّعي أنه موزع معتمد." },
  ru: { back: "Назад к MMT Global", store: "Магазин", cart: "Корзина", quote: "Запросить расчёт", by: "от MMT Global", disclaimer: "Mezopotamya Build — независимый продавец под управлением MMT Global. Не заявляет о статусе официального дистрибьютора." },
};

export function StoreShell({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const c = getLocaleCopy(shell, locale);
  const { query } = useConstructionCart();
  const count = query.data?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0;
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans" dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/90 pt-11 backdrop-blur">
        <div className="flex h-16 items-center px-4 md:px-8 max-w-screen-2xl mx-auto w-full gap-3">
          <Link href="/" className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-secondary/30 text-muted-foreground hover:text-foreground" aria-label={c.back} data-testid="link-store-back">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
          <Link href="/insaat-magaza" className="flex items-center gap-2 min-w-0" data-testid="link-store-home">
            <span className="w-7 h-7 bg-primary rounded-br-lg rounded-tl-lg flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">M</span>
            <span className="font-semibold text-base sm:text-lg tracking-tight truncate">
              Mezopotamya Build
              <span className="text-xs font-normal text-muted-foreground ms-2 hidden sm:inline">{c.by}</span>
            </span>
          </Link>
          <nav className="ms-auto flex items-center gap-2" aria-label={c.store}>
            <Link href="/insaat-magaza/teklif" className="hidden sm:inline-flex h-10 items-center gap-2 px-4 text-sm border border-border/60 hover:border-primary/60" data-testid="link-store-quote">
              <FileText className="h-4 w-4" />{c.quote}
            </Link>
            <Link href="/insaat-magaza/sepet" className="relative inline-flex h-10 items-center gap-2 px-4 text-sm bg-primary text-primary-foreground hover:bg-primary/90" data-testid="link-store-cart" aria-label={`${c.cart} (${count})`}>
              <ShoppingBag className="h-4 w-4" /><span className="hidden sm:inline">{c.cart}</span>
              <span className="min-w-5 h-5 px-1 rounded-full bg-background text-foreground text-[11px] font-semibold flex items-center justify-center" data-testid="text-cart-count">{count}</span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 md:px-8 py-8">{children}</main>
      <footer className="border-t border-border/40">
        <p className="max-w-screen-2xl mx-auto px-4 md:px-8 py-6 text-xs text-muted-foreground leading-relaxed" data-testid="text-store-disclaimer">{c.disclaimer}</p>
      </footer>
    </div>
  );
}
