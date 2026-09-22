import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Search, Filter, ChevronRight, PackageSearch, FileText, ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n, type Locale } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";

const storeCopy: Record<Locale, {
  brandName: string;
  backToSite: string;
  heroTitle: string;
  heroDesc: string;
  categories: string;
  catAll: string;
  catInsulation: string;
  catWaterproofing: string;
  catExterior: string;
  catFlooring: string;
  searchPlaceholder: string;
  emptyCatalogTitle: string;
  emptyCatalogDesc: string;
  requestQuote: string;
  contactUs: string;
  disclaimerTitle: string;
  disclaimer: string;
  productsCount: string;
  catalogLoading: string;
  catalogErrorTitle: string;
  catalogErrorDesc: string;
  priceOnRequest: string;
  shopConnected: string;
}> = {
  tr: {
    brandName: "Mezopotamya Build",
    backToSite: "MMT Global'e Dön",
    heroTitle: "İnşaat Malzemeleri Mağazası",
    heroDesc: "Güvenilir inşaat ürünleri, yalıtım çözümleri ve endüstriyel yapı malzemeleri.",
    categories: "Kategoriler",
    catAll: "Tüm Ürünler",
    catInsulation: "Isı Yalıtımı",
    catWaterproofing: "Su Yalıtımı",
    catExterior: "Dış Cephe Kaplamaları",
    catFlooring: "Endüstriyel Zemin",
    searchPlaceholder: "Ürün, kategori veya marka ara...",
    emptyCatalogTitle: "Katalog Hazırlanıyor",
    emptyCatalogDesc: "Shopify mağazası bağlı, ancak henüz yayınlanmış ürün bulunmuyor. Proje bazlı veya toptan inşaat malzemeleri için doğrudan fiyat teklifi alabilirsiniz.",
    requestQuote: "Fiyat Teklifi Al",
    contactUs: "İletişime Geç",
    disclaimerTitle: "Bağımsız Pazar Yeri",
    disclaimer: "Mezopotamya Build, MMT Global tarafından işletilen bağımsız bir pazar yeridir. Listelenen ürünler ilgili üreticilerin orijinal ürünleridir. MMT Global şu aşamada distribütörlük iddiasında bulunmaz, bağımsız satıcı olarak faaliyet gösterir.",
    productsCount: "{count} ürün listeleniyor",
    catalogLoading: "Shopify kataloğu yükleniyor...",
    catalogErrorTitle: "Katalog şu anda kullanılamıyor",
    catalogErrorDesc: "Shopify bağlantısı okunamadı. Lütfen daha sonra tekrar deneyin veya doğrudan fiyat teklifi alın.",
    priceOnRequest: "Fiyat teklifi",
    shopConnected: "Shopify mağazası bağlı",
  },
  en: {
    brandName: "Mezopotamya Build",
    backToSite: "Back to MMT Global",
    heroTitle: "Construction Materials Store",
    heroDesc: "Dependable construction products, insulation solutions, and industrial building materials.",
    categories: "Categories",
    catAll: "All Products",
    catInsulation: "Thermal Insulation",
    catWaterproofing: "Waterproofing",
    catExterior: "Exterior Coatings",
    catFlooring: "Industrial Flooring",
    searchPlaceholder: "Search products, categories, or brands...",
    emptyCatalogTitle: "Catalog in Preparation",
    emptyCatalogDesc: "The Shopify store is connected, but no published products are available yet. For project-based or wholesale construction materials, you can request a direct quote.",
    requestQuote: "Request a Quote",
    contactUs: "Contact Us",
    disclaimerTitle: "Independent Marketplace",
    disclaimer: "Mezopotamya Build is an independent marketplace operated by MMT Global. Listed items are genuine products from their respective manufacturers. MMT Global operates as an independent seller and does not claim authorized distributorship at this time.",
    productsCount: "Showing {count} products",
    catalogLoading: "Loading the Shopify catalog...",
    catalogErrorTitle: "Catalog is unavailable",
    catalogErrorDesc: "The Shopify connection could not be read. Try again later or request a direct quote.",
    priceOnRequest: "Request a price",
    shopConnected: "Shopify store connected",
  },
  ar: {
    brandName: "Mezopotamya Build",
    backToSite: "العودة إلى MMT Global",
    heroTitle: "متجر مواد البناء",
    heroDesc: "منتجات بناء موثوقة وحلول عزل ومواد بناء صناعية.",
    categories: "الفئات",
    catAll: "جميع المنتجات",
    catInsulation: "العزل الحراري",
    catWaterproofing: "العزل المائي",
    catExterior: "طلاء الواجهات الخارجية",
    catFlooring: "الأرضيات الصناعية",
    searchPlaceholder: "ابحث عن المنتجات أو الفئات أو العلامات التجارية...",
    emptyCatalogTitle: "الكتالوج قيد الإعداد",
    emptyCatalogDesc: "متجر Shopify متصل، ولكن لا توجد منتجات منشورة بعد. بالنسبة للمواد الخاصة بالمشاريع أو البيع بالجملة، يمكنك طلب عرض أسعار مباشر.",
    requestQuote: "طلب عرض أسعار",
    contactUs: "اتصل بنا",
    disclaimerTitle: "سوق مستقل",
    disclaimer: "Mezopotamya Build هو سوق مستقل تديره MMT Global. العناصر المدرجة هي منتجات أصلية من الشركات المصنعة لها. تعمل MMT Global كبائع مستقل ولا تدعي التوزيع المعتمد في هذا الوقت.",
    productsCount: "إظهار {count} منتجات",
    catalogLoading: "جار تحميل كتالوج Shopify...",
    catalogErrorTitle: "الكتالوج غير متاح حاليا",
    catalogErrorDesc: "تعذر قراءة اتصال Shopify. حاول مرة أخرى لاحقا أو اطلب عرض أسعار مباشر.",
    priceOnRequest: "طلب عرض سعر",
    shopConnected: "متجر Shopify متصل",
  },
  ru: {
    brandName: "Mezopotamya Build",
    backToSite: "Вернуться к MMT Global",
    heroTitle: "Магазин Строительных Материалов",
    heroDesc: "Надежные строительные продукты, изоляционные решения и промышленные строительные материалы.",
    categories: "Категории",
    catAll: "Все продукты",
    catInsulation: "Теплоизоляция",
    catWaterproofing: "Гидроизоляция",
    catExterior: "Внешние покрытия",
    catFlooring: "Промышленные полы",
    searchPlaceholder: "Поиск продуктов, категорий или брендов...",
    emptyCatalogTitle: "Каталог в стадии подготовки",
    emptyCatalogDesc: "Магазин Shopify подключен, но опубликованных товаров пока нет. Для проектных или оптовых строительных материалов вы можете запросить прямой расчет.",
    requestQuote: "Запросить расчет",
    contactUs: "Связаться с нами",
    disclaimerTitle: "Независимая торговая площадка",
    disclaimer: "Mezopotamya Build - это независимая торговая площадка, управляемая MMT Global. Перечисленные товары являются подлинными продуктами их соответствующих производителей. MMT Global выступает в качестве независимого продавца и в настоящее время не претендует на статус официального дистрибьютора.",
    productsCount: "Показано {count} продуктов",
    catalogLoading: "Загрузка каталога Shopify...",
    catalogErrorTitle: "Каталог недоступен",
    catalogErrorDesc: "Не удалось прочитать подключение Shopify. Попробуйте позже или запросите прямой расчет.",
    priceOnRequest: "Запросить цену",
    shopConnected: "Магазин Shopify подключен",
  }
};

const CATEGORIES = [
  { id: "all", key: "catAll" },
  { id: "insulation", key: "catInsulation" },
  { id: "waterproofing", key: "catWaterproofing" },
  { id: "exterior", key: "catExterior" },
  { id: "flooring", key: "catFlooring" },
] as const;

type CatalogProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  category: string;
  vendor: string;
  imageUrl: string | null;
  imageAlt: string | null;
  price: string | null;
  currency: string | null;
  inventory: number | null;
};

export default function ConstructionStorePage() {
  const { locale } = useI18n();
  const copy = storeCopy[locale];
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [shopConnected, setShopConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    fetch("/api/storefront/construction/catalog", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("catalog-unavailable");
        return (await response.json()) as {
          connected: boolean;
          products: CatalogProduct[];
        };
      })
      .then((catalog) => {
        setProducts(catalog.products);
        setShopConnected(catalog.connected);
        setCatalogError(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogError(true);
        setShopConnected(false);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "all" ||
        product.category.toLocaleLowerCase().includes(activeCategory);
      const matchesSearch =
        !normalizedQuery ||
        [product.title, product.description, product.vendor, product.category]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, products, searchQuery]);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans">
      {/* Store Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-16 items-center px-4 md:px-8 max-w-screen-2xl mx-auto w-full gap-4">
          <Link 
            href="/" 
            className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary/20 hover:bg-secondary/40 transition-colors text-muted-foreground hover:text-foreground"
            aria-label={copy.backToSite}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded-br-lg rounded-tl-lg flex items-center justify-center text-primary-foreground font-bold text-xs">
              M
            </div>
            <span className="font-semibold text-lg tracking-tight">
              {copy.brandName}
              <span className="text-xs font-normal text-muted-foreground ml-2 hidden sm:inline-block">
                by MMT Global
              </span>
            </span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/b2b-agi/talep"
              className="hidden sm:flex h-9 items-center justify-center px-4 text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => trackEvent("store_quote_clicked")}
            >
              {copy.requestQuote}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 md:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar / Filters */}
        <aside className="w-full md:w-64 shrink-0 space-y-8">
          <div>
            <h2 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-4">
              {copy.categories}
            </h2>
            <nav className="flex flex-col space-y-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-sm transition-colors text-left",
                    activeCategory === cat.id 
                      ? "bg-secondary/50 text-foreground font-medium border-l-2 border-primary" 
                      : "text-muted-foreground hover:bg-secondary/20 hover:text-foreground border-l-2 border-transparent"
                  )}
                >
                  {copy[cat.key as keyof typeof copy]}
                  {activeCategory === cat.id && <ChevronRight className="h-4 w-4 opacity-50" />}
                </button>
              ))}
            </nav>
          </div>

          <div className="bg-secondary/10 border border-border/40 p-4 space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Info className="h-4 w-4" />
              <h3 className="text-sm font-medium">{copy.disclaimerTitle}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {copy.disclaimer}
            </p>
          </div>
        </aside>

        {/* Main Store Area */}
        <div className="flex-1 flex flex-col min-w-0 space-y-6">
          
          {/* Store Hero / Search */}
          <div className="bg-card border border-border/40 p-6 md:p-10 flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            
            <div className="relative z-10 max-w-2xl">
              <h1 className="text-3xl md:text-4xl font-serif italic mb-3">
                {copy.heroTitle}
              </h1>
              <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                {copy.heroDesc}
              </p>
            </div>

            <div className="relative z-10 w-full max-w-md mt-4">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text"
                   placeholder={copy.searchPlaceholder}
                   value={searchQuery}
                   onChange={(event) => setSearchQuery(event.target.value)}
                   className="w-full h-11 bg-background border border-border/50 pl-10 pr-4 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                />
                 <button type="button" className="absolute right-2 p-1.5 hover:bg-secondary/50 transition-colors opacity-50" aria-label={copy.categories}>
                  <Filter className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          {/* Catalog Controls */}
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <span className="text-sm text-muted-foreground">
               {copy.productsCount.replace("{count}", String(visibleProducts.length))}
               {shopConnected && (
                 <span className="ml-3 text-xs text-primary/80">{copy.shopConnected}</span>
               )}
            </span>
          </div>

           {isLoading ? (
             <div className="flex-1 flex items-center justify-center py-20 border border-dashed border-border/40 bg-secondary/5 text-sm text-muted-foreground">
               {copy.catalogLoading}
             </div>
           ) : catalogError ? (
             <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-border/40 bg-secondary/5">
               <h3 className="text-xl font-semibold mb-3">{copy.catalogErrorTitle}</h3>
               <p className="text-muted-foreground text-sm max-w-md leading-relaxed mb-8">
                 {copy.catalogErrorDesc}
               </p>
               <Link href="/b2b-agi/talep" className="inline-flex h-11 items-center justify-center px-8 text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90">
                 {copy.requestQuote}
               </Link>
             </div>
           ) : visibleProducts.length ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
               {visibleProducts.map((product) => (
                 <article key={product.id} className="border border-border/40 bg-card overflow-hidden">
                   <div className="aspect-[4/3] bg-secondary/20">
                     {product.imageUrl ? (
                       <img src={product.imageUrl} alt={product.imageAlt || product.title} className="w-full h-full object-cover" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                         <PackageSearch className="h-8 w-8 opacity-40" />
                       </div>
                     )}
                   </div>
                   <div className="p-4">
                     <p className="text-xs uppercase tracking-wider text-primary mb-2">{product.category || product.vendor}</p>
                     <h3 className="font-semibold">{product.title}</h3>
                     {product.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{product.description}</p>}
                     <div className="mt-4 flex items-center justify-between gap-3">
                       <span className="text-sm font-medium">{product.price ? `${product.price}${product.currency ? ` ${product.currency}` : ""}` : copy.priceOnRequest}</span>
                       <Link href="/b2b-agi/talep" className="text-sm text-primary hover:underline">{copy.requestQuote}</Link>
                     </div>
                   </div>
                 </article>
               ))}
             </div>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-border/40 bg-secondary/5">
               <div className="w-16 h-16 mb-6 rounded-full bg-secondary/30 flex items-center justify-center text-muted-foreground">
                 <PackageSearch className="h-8 w-8 opacity-50" />
               </div>
               <h3 className="text-xl font-semibold mb-3">{copy.emptyCatalogTitle}</h3>
               <p className="text-muted-foreground text-sm max-w-md leading-relaxed mb-8">
                 {copy.emptyCatalogDesc}
               </p>
               <div className="flex flex-col sm:flex-row gap-4">
                 <Link href="/b2b-agi/talep" className="inline-flex h-11 items-center justify-center px-8 text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90">
                   <FileText className="h-4 w-4 mr-2" />
                   {copy.requestQuote}
                 </Link>
                 <Link href="/iletisim" className="inline-flex h-11 items-center justify-center px-8 text-sm font-medium transition-colors border border-border/50 bg-transparent hover:bg-secondary/20 hover:text-foreground text-muted-foreground">
                   {copy.contactUs}
                   <ArrowRight className="h-4 w-4 ml-2" />
                 </Link>
               </div>
             </div>
           )}

        </div>
      </main>
    </div>
  );
}
