import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, PackageSearch, FileText, RefreshCw, Info } from "lucide-react";
import {
  useGetConstructionCatalog,
  getGetConstructionCatalogQueryKey,
  type ConstructionCatalogProduct,
  type ConstructionCollection,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useI18n, type Locale } from "@/lib/i18n";
import { getLocaleCopy, type CoreLocale } from "@/lib/locale-copy";
import { StoreShell, formatMoney } from "@/lib/construction-shop";

const t: Record<CoreLocale, Record<string, string>> = {
  tr: { title: "İnşaat malzemeleri", desc: "Shopify kataloğundan yayınlanan gerçek ürünler. Proje miktarları için teklif isteyin.", search: "Ürün, marka veya kategori ara", collections: "Koleksiyonlar", category: "Kategori", all: "Tümü", count: "{n} ürün yüklendi", more: "Daha fazla yükle", loading: "Yükleniyor", errT: "Katalog şu anda kullanılamıyor", errD: "Shopify mağaza bağlantısı okunamadı. Ürün gösterilmiyor; tekrar deneyin veya teklif isteyin.", retry: "Tekrar dene", emptyT: "Yayınlanmış ürün yok", emptyD: "Mağaza bağlı ancak henüz yayınlanmış ürün bulunmuyor.", noMatch: "Filtrelerle eşleşen ürün yok.", quote: "Teklif iste", quoteOnly: "Teklif ile", price: "Fiyat teklif ile", independent: "Bağımsız satıcı · yetkili distribütör değildir" },
  en: { title: "Construction materials", desc: "Real products published from the Shopify catalog. Request a quote for project volumes.", search: "Search products, brands or categories", collections: "Collections", category: "Category", all: "All", count: "{n} products loaded", more: "Load more", loading: "Loading", errT: "Catalog is unavailable", errD: "The Shopify store connection could not be read. No products are shown; retry or request a quote.", retry: "Retry", emptyT: "No published products", emptyD: "The store is connected but has no published products yet.", noMatch: "No products match these filters.", quote: "Request quote", quoteOnly: "Quote only", price: "Price on quote", independent: "Independent seller · not an authorized distributor" },
  ar: { title: "مواد البناء", desc: "منتجات حقيقية منشورة من كتالوج Shopify. اطلب عرض سعر لكميات المشاريع.", search: "ابحث عن منتج أو علامة أو فئة", collections: "المجموعات", category: "الفئة", all: "الكل", count: "تم تحميل {n} منتج", more: "تحميل المزيد", loading: "جار التحميل", errT: "الكتالوج غير متاح", errD: "تعذرت قراءة اتصال متجر Shopify. لا تُعرض أي منتجات؛ أعد المحاولة أو اطلب عرض سعر.", retry: "إعادة المحاولة", emptyT: "لا توجد منتجات منشورة", emptyD: "المتجر متصل لكن لا توجد منتجات منشورة بعد.", noMatch: "لا توجد منتجات مطابقة.", quote: "طلب عرض سعر", quoteOnly: "بعرض سعر فقط", price: "السعر عند الطلب", independent: "بائع مستقل · ليس موزعاً معتمداً" },
  ru: { title: "Строительные материалы", desc: "Реальные товары, опубликованные в каталоге Shopify. Для проектных объёмов запросите расчёт.", search: "Поиск товаров, брендов или категорий", collections: "Коллекции", category: "Категория", all: "Все", count: "Загружено товаров: {n}", more: "Загрузить ещё", loading: "Загрузка", errT: "Каталог недоступен", errD: "Не удалось прочитать подключение Shopify. Товары не показываются; повторите или запросите расчёт.", retry: "Повторить", emptyT: "Нет опубликованных товаров", emptyD: "Магазин подключён, но опубликованных товаров пока нет.", noMatch: "Нет товаров по этим фильтрам.", quote: "Запросить расчёт", quoteOnly: "Только по запросу", price: "Цена по запросу", independent: "Независимый продавец · не официальный дистрибьютор" },
};

export default function ConstructionStorePage() {
  const { locale } = useI18n();
  const c = getLocaleCopy(t, locale);
  const [after, setAfter] = useState<string | undefined>(undefined);
  const [products, setProducts] = useState<ConstructionCatalogProduct[]>([]);
  const [collections, setCollections] = useState<ConstructionCollection[]>([]);
  const [collection, setCollection] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const params = { first: 20, ...(after ? { after } : {}) };
  const catalog = useGetConstructionCatalog(params, { query: { queryKey: getGetConstructionCatalogQueryKey(params), retry: 1 } });
  const data = catalog.data;

  useEffect(() => {
    if (!data) return;
    setProducts((prev) => {
      const map = new Map((after ? prev : []).map((p) => [p.id, p]));
      data.products.forEach((p) => map.set(p.id, p));
      return Array.from(map.values());
    });
    setCollections((prev) => {
      const map = new Map((after ? prev : []).map((p) => [p.handle, p]));
      data.collections.forEach((p) => map.set(p.handle, p));
      data.products.forEach((p) => p.collections.forEach((col) => { if (!map.has(col.handle)) map.set(col.handle, col); }));
      return Array.from(map.values());
    });
  }, [data, after]);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(), [products]);
  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return products.filter((p) =>
      (collection === "all" || p.collections.some((col) => col.handle === collection)) &&
      (category === "all" || p.category === category) &&
      (!q || [p.title, p.description, p.vendor, p.category].join(" ").toLocaleLowerCase().includes(q)));
  }, [products, collection, category, search]);

  const initialLoading = catalog.isLoading && products.length === 0;
  const failed = catalog.isError && products.length === 0;

  return (
    <StoreShell>
      <section className="bg-card border border-border/40 p-6 md:p-10 relative overflow-hidden mb-8">
        <div className="absolute top-0 end-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 pointer-events-none" />
        <p className="text-xs uppercase tracking-[0.2em] text-primary mb-3 flex items-center gap-2"><Info className="h-3.5 w-3.5" />{c.independent}</p>
        <h1 className="text-3xl md:text-5xl font-serif italic mb-3">{c.title}</h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">{c.desc}</p>
        <label className="relative flex items-center max-w-lg mt-6">
          <span className="sr-only">{c.search}</span>
          <Search className="absolute start-3 h-4 w-4 text-muted-foreground" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={c.search} data-testid="input-store-search"
            className="w-full h-12 bg-background border border-border/60 ps-10 pe-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
        </label>
      </section>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-64 shrink-0 space-y-6">
          <div>
            <h2 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-3">{c.collections}</h2>
            <div className="flex lg:flex-col gap-1 overflow-x-auto pb-1" role="group" aria-label={c.collections}>
              {[{ handle: "all", title: c.all }, ...collections].map((col) => (
                <button key={col.handle} type="button" onClick={() => setCollection(col.handle)} aria-pressed={collection === col.handle} data-testid={`button-collection-${col.handle}`}
                  className={cn("shrink-0 min-h-10 px-3 text-sm text-start border-s-2 whitespace-nowrap transition-colors",
                    collection === col.handle ? "border-primary bg-secondary/40 font-medium" : "border-transparent text-muted-foreground hover:bg-secondary/20 hover:text-foreground")}>
                  {col.title}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">{c.category}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} data-testid="select-store-category"
              className="mt-2 w-full h-11 bg-background border border-border/60 px-3 text-sm focus:outline-none focus:border-primary">
              <option value="all">{c.all}</option>
              {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </label>
          <Link href="/insaat-magaza/teklif" className="flex items-center justify-center gap-2 h-11 border border-primary/60 text-primary text-sm hover:bg-primary hover:text-primary-foreground transition-colors" data-testid="link-sidebar-quote">
            <FileText className="h-4 w-4" />{c.quote}
          </Link>
        </aside>

        <div className="flex-1 min-w-0">
          {initialLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-label={c.loading} aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border border-border/40 bg-card animate-pulse"><div className="aspect-[4/3] bg-secondary/30" /><div className="p-4 space-y-2"><div className="h-3 w-1/3 bg-secondary/40" /><div className="h-4 w-2/3 bg-secondary/40" /></div></div>
              ))}
            </div>
          ) : failed ? (
            <Empty title={c.errT} desc={c.errD}>
              <button type="button" onClick={() => catalog.refetch()} className="inline-flex h-11 items-center gap-2 px-6 border border-border/60 text-sm hover:border-primary" data-testid="button-catalog-retry"><RefreshCw className="h-4 w-4" />{c.retry}</button>
              <Link href="/insaat-magaza/teklif" className="inline-flex h-11 items-center px-6 bg-primary text-primary-foreground text-sm">{c.quote}</Link>
            </Empty>
          ) : products.length === 0 ? (
            <Empty title={c.emptyT} desc={c.emptyD}>
              <Link href="/insaat-magaza/teklif" className="inline-flex h-11 items-center px-6 bg-primary text-primary-foreground text-sm" data-testid="link-empty-quote">{c.quote}</Link>
            </Empty>
          ) : (
            <>
              <p className="text-sm text-muted-foreground pb-3 mb-4 border-b border-border/40" data-testid="text-products-count">{c.count.replace("{n}", String(products.length))}{data?.shopName ? ` · ${data.shopName}` : ""}</p>
              {visible.length === 0 ? <p className="py-16 text-center text-muted-foreground">{c.noMatch}</p> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {visible.map((p) => (
                    <Link key={p.id} href={`/insaat-magaza/urun/${encodeURIComponent(p.handle)}`} data-testid={`card-product-${p.handle}`}
                      className="group border border-border/40 bg-card overflow-hidden flex flex-col hover:border-primary/60 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                      <div className="aspect-[4/3] bg-secondary/20 overflow-hidden">
                        {p.imageUrl ? <img src={p.imageUrl} alt={p.imageAlt || p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                          : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><PackageSearch className="h-8 w-8 opacity-40" /></div>}
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <p className="text-[11px] uppercase tracking-wider text-primary mb-1">{p.category || p.vendor}</p>
                        <h3 className="font-semibold group-hover:text-primary transition-colors">{p.title}</h3>
                        {p.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                        <div className="mt-auto pt-4 flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium">{p.quoteRequired ? c.price : formatMoney(p.price, p.currency, locale) ?? c.price}</span>
                          {p.quoteRequired && <span className="text-[11px] uppercase tracking-wider border border-border/60 px-2 py-0.5">{c.quoteOnly}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {data?.pageInfo.hasNextPage && data.pageInfo.endCursor && (
                <div className="flex justify-center mt-8">
                  <button type="button" disabled={catalog.isFetching} onClick={() => setAfter(data.pageInfo.endCursor ?? undefined)} data-testid="button-load-more"
                    className="h-11 px-8 border border-border/60 text-sm hover:border-primary disabled:opacity-50">{catalog.isFetching ? c.loading : c.more}</button>
                </div>
              )}
              {catalog.isError && products.length > 0 && (
                <div className="flex justify-center mt-4"><button type="button" onClick={() => catalog.refetch()} className="text-sm text-primary underline">{c.retry}</button></div>
              )}
            </>
          )}
        </div>
      </div>
    </StoreShell>
  );
}

function Empty({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-border/50 bg-secondary/5">
      <PackageSearch className="h-10 w-10 mb-5 text-muted-foreground opacity-60" />
      <h2 className="text-xl font-semibold mb-3" data-testid="text-catalog-state">{title}</h2>
      <p className="text-muted-foreground text-sm max-w-md leading-relaxed mb-8">{desc}</p>
      <div className="flex flex-col sm:flex-row gap-3">{children}</div>
    </div>
  );
}
