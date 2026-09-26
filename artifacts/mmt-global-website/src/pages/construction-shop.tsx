import { useMemo, useState, type FormEvent } from "react";
import { Link, useParams, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileText, Lock, Minus, PackageSearch, Plus, RefreshCw, ShoppingBag, Trash2 } from "lucide-react";
import {
  useGetConstructionProduct,
  getGetConstructionProductQueryKey,
  useCreateConstructionCart,
  useAddConstructionCartLine,
  useUpdateConstructionCartLine,
  useRemoveConstructionCartLine,
  useCheckoutConstructionCart,
  useCreateConstructionQuote,
  getGetConstructionCartQueryKey,
  type ConstructionCart,
  type ConstructionQuoteReference,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useI18n, type Locale } from "@/lib/i18n";
import { StoreShell, encodeCartId, errorStatus, formatMoney, useConstructionCart } from "@/lib/construction-shop";

const T = {
  tr: {
    back: "Kataloğa dön", variant: "Seçenek", qty: "Miktar", add: "Sepete ekle", adding: "Ekleniyor", added: "Sepete eklendi", viewCart: "Sepeti gör",
    quote: "Bu ürün için teklif iste", quoteOnly: "Bu seçenek yalnızca teklif ile satılır.", unavailable: "Bu seçenek şu anda satışta değil.", stock: "Stok: {n}", overStock: "Miktar mevcut stoğu aşıyor.",
    addErr: "Ürün sepete eklenemedi. Stok, teklif gereksinimi veya mağaza bağlantısını kontrol edin.", notFound: "Ürün bulunamadı", notFoundD: "Bu ürün katalogda yayınlanmamış olabilir.", loadErr: "Ürün yüklenemedi", retry: "Tekrar dene", vendor: "Üretici",
    cart: "Sepet", empty: "Sepetiniz boş", emptyD: "Katalogdan ürün ekleyin veya proje miktarları için teklif isteyin.", browse: "Kataloğa git", total: "Ara toplam", remove: "Kaldır", lineErr: "Sepet güncellenemedi.", cartErr: "Sepet yüklenemedi.",
    checkout: "Ödemeye geç", checkingOut: "Kontrol ediliyor", gateT: "Ödeme henüz açık değil", gateD: "Çevrimiçi ödeme, Shopify satıcı hesabı doğrulaması sunucu tarafında tamamlanana kadar kapalıdır. Şu anda test modu veya canlı ödeme etkin değildir; sipariş oluşturulmaz ve kartınızdan ücret alınmaz.",
    blocked: "Ödeme sunucu tarafından engellendi: satıcı doğrulaması bekleniyor. Sepetiniz korunuyor; isterseniz teklif isteyebilirsiniz.", checkoutErr: "Ödeme başlatılamadı. Lütfen daha sonra tekrar deneyin.", redirecting: "Güvenli Shopify ödeme sayfasına yönlendiriliyorsunuz",
    qTitle: "Proje teklifi", qDesc: "Miktar, ölçü ve teslimat bilgilerini paylaşın. Ekibimiz referans numaranız üzerinden dönüş yapar.", selected: "Seçili ürün", clear: "Kaldır",
    fQty: "Miktar", fDim: "Ölçüler / teknik detay", fDimH: "Örn. 1200 x 600 mm, 50 mm kalınlık", fLoc: "Teslimat yeri", fLocH: "İl, ilçe, şantiye adresi", fName: "Ad soyad", fEmail: "E-posta", fPhone: "Telefon", fNotes: "Notlar (isteğe bağlı)",
    send: "Teklif talebini gönder", sending: "Gönderiliyor", required: "Zorunlu alanları doldurun.", badEmail: "Geçerli bir e-posta girin.", badPhone: "Telefon en az 5 karakter olmalı.", sendErr: "Talep gönderilemedi. Lütfen tekrar deneyin.",
    okT: "Talebiniz alındı", okD: "Referans numaranızı saklayın. Ekibimiz bu numara ile size dönüş yapacaktır.", ref: "Referans", another: "Yeni talep",
  },
  en: {
    back: "Back to catalog", variant: "Option", qty: "Quantity", add: "Add to cart", adding: "Adding", added: "Added to cart", viewCart: "View cart",
    quote: "Request a quote for this product", quoteOnly: "This option is sold by quote only.", unavailable: "This option is not currently for sale.", stock: "Stock: {n}", overStock: "Quantity exceeds available stock.",
    addErr: "Could not add to cart. Check stock, quote requirement or store connection.", notFound: "Product not found", notFoundD: "This product may not be published in the catalog.", loadErr: "Product could not be loaded", retry: "Retry", vendor: "Manufacturer",
    cart: "Cart", empty: "Your cart is empty", emptyD: "Add products from the catalog or request a quote for project volumes.", browse: "Browse catalog", total: "Subtotal", remove: "Remove", lineErr: "Cart could not be updated.", cartErr: "Cart could not be loaded.",
    checkout: "Proceed to checkout", checkingOut: "Checking", gateT: "Checkout is not open yet", gateD: "Online payment stays closed until Shopify merchant verification is completed server-side. Neither test mode nor live payment is active right now; no order is created and no card is charged.",
    blocked: "Checkout was blocked by the server: merchant verification pending. Your cart is kept; you can request a quote instead.", checkoutErr: "Checkout could not start. Please try again later.", redirecting: "Redirecting to the secure Shopify checkout",
    qTitle: "Project quote", qDesc: "Share quantity, dimensions and delivery details. Our team will respond using your reference number.", selected: "Selected product", clear: "Remove",
    fQty: "Quantity", fDim: "Dimensions / technical details", fDimH: "e.g. 1200 x 600 mm, 50 mm thick", fLoc: "Delivery location", fLocH: "City, district, site address", fName: "Full name", fEmail: "Email", fPhone: "Phone", fNotes: "Notes (optional)",
    send: "Send quote request", sending: "Sending", required: "Fill in the required fields.", badEmail: "Enter a valid email.", badPhone: "Phone must be at least 5 characters.", sendErr: "Request could not be sent. Please try again.",
    okT: "Request received", okD: "Keep your reference number. Our team will contact you with it.", ref: "Reference", another: "New request",
  },
  ar: {
    back: "العودة إلى الكتالوج", variant: "الخيار", qty: "الكمية", add: "أضف إلى السلة", adding: "جار الإضافة", added: "أضيف إلى السلة", viewCart: "عرض السلة",
    quote: "اطلب عرض سعر لهذا المنتج", quoteOnly: "يباع هذا الخيار بعرض سعر فقط.", unavailable: "هذا الخيار غير معروض للبيع حالياً.", stock: "المخزون: {n}", overStock: "الكمية تتجاوز المخزون المتاح.",
    addErr: "تعذرت الإضافة إلى السلة. تحقق من المخزون أو متطلب عرض السعر أو اتصال المتجر.", notFound: "المنتج غير موجود", notFoundD: "قد لا يكون هذا المنتج منشوراً في الكتالوج.", loadErr: "تعذر تحميل المنتج", retry: "إعادة المحاولة", vendor: "الشركة المصنعة",
    cart: "السلة", empty: "سلتك فارغة", emptyD: "أضف منتجات من الكتالوج أو اطلب عرض سعر لكميات المشاريع.", browse: "تصفح الكتالوج", total: "المجموع الفرعي", remove: "إزالة", lineErr: "تعذر تحديث السلة.", cartErr: "تعذر تحميل السلة.",
    checkout: "المتابعة إلى الدفع", checkingOut: "جار التحقق", gateT: "الدفع غير مفتوح بعد", gateD: "يبقى الدفع الإلكتروني مغلقاً حتى يكتمل التحقق من حساب تاجر Shopify على الخادم. لا وضع اختبار ولا دفع مباشر مفعل حالياً؛ لا يتم إنشاء طلب ولا خصم من البطاقة.",
    blocked: "حظر الخادم الدفع: بانتظار التحقق من التاجر. سلتك محفوظة؛ يمكنك طلب عرض سعر بدلاً من ذلك.", checkoutErr: "تعذر بدء الدفع. حاول لاحقاً.", redirecting: "جار التحويل إلى صفحة دفع Shopify الآمنة",
    qTitle: "عرض سعر لمشروع", qDesc: "شارك الكمية والأبعاد وتفاصيل التسليم. سيرد فريقنا باستخدام الرقم المرجعي.", selected: "المنتج المحدد", clear: "إزالة",
    fQty: "الكمية", fDim: "الأبعاد / التفاصيل الفنية", fDimH: "مثال: 1200 × 600 مم، سماكة 50 مم", fLoc: "مكان التسليم", fLocH: "المدينة، الحي، عنوان الموقع", fName: "الاسم الكامل", fEmail: "البريد الإلكتروني", fPhone: "الهاتف", fNotes: "ملاحظات (اختياري)",
    send: "إرسال الطلب", sending: "جار الإرسال", required: "املأ الحقول المطلوبة.", badEmail: "أدخل بريداً صالحاً.", badPhone: "يجب ألا يقل الهاتف عن 5 أحرف.", sendErr: "تعذر إرسال الطلب. حاول مرة أخرى.",
    okT: "تم استلام طلبك", okD: "احتفظ بالرقم المرجعي. سيتواصل فريقنا معك به.", ref: "المرجع", another: "طلب جديد",
  },
  ru: {
    back: "Назад в каталог", variant: "Вариант", qty: "Количество", add: "В корзину", adding: "Добавление", added: "Добавлено в корзину", viewCart: "Открыть корзину",
    quote: "Запросить расчёт по товару", quoteOnly: "Этот вариант продаётся только по запросу.", unavailable: "Этот вариант сейчас не продаётся.", stock: "Остаток: {n}", overStock: "Количество превышает остаток.",
    addErr: "Не удалось добавить в корзину. Проверьте остаток, требование расчёта или подключение магазина.", notFound: "Товар не найден", notFoundD: "Возможно, товар не опубликован в каталоге.", loadErr: "Не удалось загрузить товар", retry: "Повторить", vendor: "Производитель",
    cart: "Корзина", empty: "Корзина пуста", emptyD: "Добавьте товары из каталога или запросите расчёт для проектных объёмов.", browse: "В каталог", total: "Промежуточный итог", remove: "Удалить", lineErr: "Не удалось обновить корзину.", cartErr: "Не удалось загрузить корзину.",
    checkout: "Перейти к оплате", checkingOut: "Проверка", gateT: "Оплата пока закрыта", gateD: "Онлайн-оплата закрыта до завершения серверной проверки продавца Shopify. Ни тестовый, ни боевой режим оплаты сейчас не активен; заказ не создаётся, карта не списывается.",
    blocked: "Сервер заблокировал оплату: ожидается проверка продавца. Корзина сохранена; вы можете запросить расчёт.", checkoutErr: "Не удалось начать оплату. Попробуйте позже.", redirecting: "Переход на защищённую страницу оплаты Shopify",
    qTitle: "Расчёт для проекта", qDesc: "Укажите количество, размеры и доставку. Команда ответит по вашему номеру заявки.", selected: "Выбранный товар", clear: "Убрать",
    fQty: "Количество", fDim: "Размеры / технические детали", fDimH: "Напр. 1200 x 600 мм, толщина 50 мм", fLoc: "Место доставки", fLocH: "Город, район, адрес объекта", fName: "Имя и фамилия", fEmail: "Эл. почта", fPhone: "Телефон", fNotes: "Примечания (необязательно)",
    send: "Отправить запрос", sending: "Отправка", required: "Заполните обязательные поля.", badEmail: "Введите корректный адрес.", badPhone: "Телефон — не менее 5 символов.", sendErr: "Не удалось отправить запрос. Повторите.",
    okT: "Заявка принята", okD: "Сохраните номер заявки. Команда свяжется с вами по нему.", ref: "Номер", another: "Новая заявка",
  },
} satisfies Record<Locale, Record<string, string>>;

const btn = "inline-flex min-h-11 items-center justify-center gap-2 px-6 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const input = "w-full min-h-11 bg-background border border-border/60 px-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";

function useCartWriter() {
  const qc = useQueryClient();
  const { cartId, setCartId, encoded } = useConstructionCart();
  const create = useCreateConstructionCart();
  const add = useAddConstructionCartLine();
  const store = (cart: ConstructionCart) => {
    setCartId(cart.id);
    qc.setQueryData(getGetConstructionCartQueryKey(encodeCartId(cart.id)), cart);
  };
  const addLine = async (variantId: string, quantity: number) => {
    if (cartId) {
      try {
        store(await add.mutateAsync({ cartId: encoded, data: { variantId, quantity } }));
        return;
      } catch (e) {
        if (errorStatus(e) !== 404) throw e;
        setCartId(null);
      }
    }
    store(await create.mutateAsync({ data: { variantId, quantity } }));
  };
  return { addLine, pending: create.isPending || add.isPending };
}

export function ConstructionProductPage() {
  const { locale } = useI18n();
  const c = T[locale];
  const { handle = "" } = useParams<{ handle: string }>();
  const decoded = decodeURIComponent(handle);
  const product = useGetConstructionProduct(encodeURIComponent(decoded), { query: { queryKey: getGetConstructionProductQueryKey(encodeURIComponent(decoded)), retry: false, enabled: Boolean(decoded) } });
  const p = product.data;
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { addLine, pending } = useCartWriter();
  const variant = p?.variants.find((v) => v.id === variantId) ?? p?.variants.find((v) => v.availableForSale && !v.quoteRequired) ?? p?.variants[0];
  const stock = variant?.inventoryQuantity;
  const quoteOnly = Boolean(p?.quoteRequired || variant?.quoteRequired);
  const over = stock != null && qty > stock;
  const canAdd = Boolean(variant && variant.availableForSale && !quoteOnly && !over && qty >= 1);

  if (product.isLoading) return <StoreShell><div className="grid md:grid-cols-2 gap-10 animate-pulse" aria-busy="true"><div className="aspect-square bg-secondary/30" /><div className="space-y-4"><div className="h-8 w-2/3 bg-secondary/40" /><div className="h-4 w-full bg-secondary/30" /><div className="h-4 w-5/6 bg-secondary/30" /></div></div></StoreShell>;
  if (!p) {
    const nf = errorStatus(product.error) === 404;
    return <StoreShell><div className="py-20 text-center max-w-md mx-auto">
      <PackageSearch className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
      <h1 className="text-2xl font-semibold mb-3" data-testid="text-product-error">{nf ? c.notFound : c.loadErr}</h1>
      {nf && <p className="text-muted-foreground mb-6">{c.notFoundD}</p>}
      <div className="flex gap-3 justify-center">{!nf && <button type="button" onClick={() => product.refetch()} className={cn(btn, "border border-border/60")}><RefreshCw className="h-4 w-4" />{c.retry}</button>}
        <Link href="/insaat-magaza" className={cn(btn, "bg-primary text-primary-foreground")}>{c.back}</Link></div>
    </div></StoreShell>;
  }

  const submit = async () => {
    if (!variant || !canAdd) return;
    setMsg(null);
    try { await addLine(variant.id, qty); setMsg({ ok: true, text: c.added }); }
    catch { setMsg({ ok: false, text: c.addErr }); }
  };
  const quoteHref = `/insaat-magaza/teklif?productId=${encodeURIComponent(p.id)}&title=${encodeURIComponent(p.title)}${variant ? `&variantId=${encodeURIComponent(variant.id)}&variant=${encodeURIComponent(variant.title)}` : ""}&quantity=${qty}`;

  return (
    <StoreShell>
      <Link href="/insaat-magaza" className="text-sm text-muted-foreground hover:text-primary" data-testid="link-back-catalog">{c.back}</Link>
      <div className="grid md:grid-cols-2 gap-8 lg:gap-14 mt-4">
        <div className="aspect-square bg-secondary/20 border border-border/40 overflow-hidden">
          {p.imageUrl ? <img src={p.imageUrl} alt={p.imageAlt || p.title} className="w-full h-full object-cover" data-testid="img-product" />
            : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><PackageSearch className="h-12 w-12 opacity-40" /></div>}
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary">{[p.category, ...p.collections.map((x) => x.title)].filter(Boolean).join(" · ")}</p>
          <h1 className="text-3xl md:text-4xl font-serif italic mt-2" data-testid="text-product-title">{p.title}</h1>
          {p.vendor && <p className="text-sm text-muted-foreground mt-2">{c.vendor}: {p.vendor}</p>}
          <p className="text-2xl font-semibold mt-6" data-testid="text-product-price">{quoteOnly ? c.quoteOnly : formatMoney(variant?.price ?? p.price, variant?.currency ?? p.currency, locale)}</p>
          {p.description && <p className="mt-6 text-muted-foreground leading-relaxed whitespace-pre-line">{p.description}</p>}

          {p.variants.length > 1 && (
            <fieldset className="mt-8">
              <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{c.variant}</legend>
              <div className="flex flex-wrap gap-2">
                {p.variants.map((v) => (
                  <button key={v.id} type="button" aria-pressed={variant?.id === v.id} onClick={() => { setVariantId(v.id); setMsg(null); }} data-testid={`button-variant-${v.id}`}
                    className={cn("min-h-11 px-4 text-sm border transition-colors", variant?.id === v.id ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/60", !v.availableForSale && "opacity-60 line-through")}>
                    {v.title}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-6 flex flex-wrap items-end gap-4">
            <div>
              <span id="qty-label" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{c.qty}</span>
              <div className="flex items-center border border-border/60" role="group" aria-labelledby="qty-label">
                <button type="button" className="w-11 h-11 flex items-center justify-center hover:bg-secondary/30" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="-" data-testid="button-qty-dec"><Minus className="h-4 w-4" /></button>
                <input type="number" min={1} max={1000} value={qty} aria-labelledby="qty-label" onChange={(e) => setQty(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))} className="w-16 h-11 text-center bg-transparent border-x border-border/60 focus:outline-none" data-testid="input-qty" />
                <button type="button" className="w-11 h-11 flex items-center justify-center hover:bg-secondary/30" onClick={() => setQty((q) => Math.min(1000, q + 1))} aria-label="+" data-testid="button-qty-inc"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
            {stock != null && <span className="text-sm text-muted-foreground pb-3" data-testid="text-stock">{c.stock.replace("{n}", String(stock))}</span>}
          </div>

          <div className="mt-4 space-y-1 text-sm" aria-live="polite">
            {quoteOnly && <p className="text-muted-foreground">{c.quoteOnly}</p>}
            {variant && !variant.availableForSale && <p className="text-destructive">{c.unavailable}</p>}
            {over && <p className="text-destructive">{c.overStock}</p>}
            {msg && <p className={msg.ok ? "text-primary flex items-center gap-2" : "text-destructive"} data-testid="status-add-cart">{msg.ok && <CheckCircle2 className="h-4 w-4" />}{msg.text}{msg.ok && <Link href="/insaat-magaza/sepet" className="underline ms-2">{c.viewCart}</Link>}</p>}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button type="button" disabled={!canAdd || pending} onClick={submit} className={cn(btn, "bg-primary text-primary-foreground hover:bg-primary/90")} data-testid="button-add-cart">
              <ShoppingBag className="h-4 w-4" />{pending ? c.adding : c.add}
            </button>
            <Link href={quoteHref} className={cn(btn, "border border-border/60 hover:border-primary")} data-testid="link-product-quote"><FileText className="h-4 w-4" />{c.quote}</Link>
          </div>
        </div>
      </div>
    </StoreShell>
  );
}

function safeCheckoutUrl(result: unknown): string | null {
  const raw = (result as { checkoutUrl?: unknown } | null)?.checkoutUrl;
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

export function ConstructionCartPage() {
  const { locale } = useI18n();
  const c = T[locale];
  const qc = useQueryClient();
  const { cartId, encoded, query } = useConstructionCart();
  const update = useUpdateConstructionCartLine();
  const remove = useRemoveConstructionCartLine();
  const checkout = useCheckoutConstructionCart();
  const [lineErr, setLineErr] = useState(false);
  const [checkoutMsg, setCheckoutMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const cart = query.data;
  const key = getGetConstructionCartQueryKey(encoded);
  const onCart = { onSuccess: (next: ConstructionCart) => { setLineErr(false); qc.setQueryData(key, next); }, onError: () => setLineErr(true) };
  const busy = update.isPending || remove.isPending;

  const startCheckout = () => {
    setCheckoutMsg(null);
    checkout.mutate({ cartId: encoded }, {
      onSuccess: (result) => {
        const url = safeCheckoutUrl(result);
        if (url) { setCheckoutMsg({ tone: "info", text: c.redirecting }); window.location.assign(url); }
        else setCheckoutMsg({ tone: "error", text: c.checkoutErr });
      },
      onError: (e) => setCheckoutMsg(errorStatus(e) === 503 ? { tone: "info", text: c.blocked } : { tone: "error", text: c.checkoutErr }),
    });
  };

  return (
    <StoreShell>
      <h1 className="text-3xl md:text-4xl font-serif italic mb-8">{c.cart}</h1>
      {cartId && query.isLoading ? (
        <div className="space-y-3 animate-pulse" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-20 bg-secondary/30" />)}</div>
      ) : cartId && query.isError && errorStatus(query.error) !== 404 ? (
        <div className="py-16 text-center"><p className="mb-4" data-testid="text-cart-error">{c.cartErr}</p><button type="button" onClick={() => query.refetch()} className={cn(btn, "border border-border/60")}><RefreshCw className="h-4 w-4" />{c.retry}</button></div>
      ) : !cart || cart.lines.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-border/50 max-w-xl mx-auto px-4">
          <ShoppingBag className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2" data-testid="text-cart-empty">{c.empty}</h2>
          <p className="text-muted-foreground text-sm mb-6">{c.emptyD}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center"><Link href="/insaat-magaza" className={cn(btn, "bg-primary text-primary-foreground")}>{c.browse}</Link><Link href="/insaat-magaza/teklif" className={cn(btn, "border border-border/60")}>{c.qTitle}</Link></div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_380px] gap-8">
          <ul className="divide-y divide-border/40 border-y border-border/40">
            {cart.lines.map((line) => (
              <li key={line.id} className="py-4 flex flex-wrap items-center gap-4" data-testid={`row-cart-line-${line.id}`}>
                <div className="flex-1 min-w-[12rem]"><p className="font-medium">{line.title}</p><p className="text-sm text-muted-foreground">{formatMoney(line.price, line.currency, locale)}</p></div>
                <div className="flex items-center border border-border/60" role="group" aria-label={`${c.qty}: ${line.title}`}>
                  <button type="button" disabled={busy} className="w-11 h-11 flex items-center justify-center hover:bg-secondary/30 disabled:opacity-40" aria-label="-" data-testid={`button-line-dec-${line.id}`}
                    onClick={() => line.quantity > 1 ? update.mutate({ cartId: encoded, data: { lineId: line.id, quantity: line.quantity - 1 } }, onCart) : remove.mutate({ cartId: encoded, data: { lineId: line.id } }, onCart)}><Minus className="h-4 w-4" /></button>
                  <span className="w-12 text-center" data-testid={`text-line-qty-${line.id}`} aria-live="polite">{line.quantity}</span>
                  <button type="button" disabled={busy || line.quantity >= 1000} className="w-11 h-11 flex items-center justify-center hover:bg-secondary/30 disabled:opacity-40" aria-label="+" data-testid={`button-line-inc-${line.id}`}
                    onClick={() => update.mutate({ cartId: encoded, data: { lineId: line.id, quantity: line.quantity + 1 } }, onCart)}><Plus className="h-4 w-4" /></button>
                </div>
                <button type="button" disabled={busy} onClick={() => remove.mutate({ cartId: encoded, data: { lineId: line.id } }, onCart)} className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-destructive" aria-label={`${c.remove}: ${line.title}`} data-testid={`button-line-remove-${line.id}`}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
            {lineErr && <li className="py-3 text-sm text-destructive" role="alert">{c.lineErr}</li>}
          </ul>
          <aside className="border border-border/40 bg-card p-6 h-fit space-y-5">
            <div className="flex justify-between text-lg"><span>{c.total}</span><span className="font-semibold" data-testid="text-cart-total">{formatMoney(cart.totalAmount, cart.currency, locale)}</span></div>
            <div className="border border-primary/30 bg-primary/5 p-4 text-sm" data-testid="status-checkout-gate">
              <p className="font-semibold flex items-center gap-2 mb-2"><Lock className="h-4 w-4 text-primary" />{c.gateT}</p>
              <p className="text-muted-foreground leading-relaxed">{c.gateD}</p>
            </div>
            <button type="button" onClick={startCheckout} disabled={checkout.isPending || busy} className={cn(btn, "w-full bg-primary text-primary-foreground hover:bg-primary/90")} data-testid="button-checkout">
              <Lock className="h-4 w-4" />{checkout.isPending ? c.checkingOut : c.checkout}
            </button>
            {checkoutMsg && <p role="status" className={cn("text-sm flex gap-2", checkoutMsg.tone === "error" ? "text-destructive" : "text-foreground")} data-testid="status-checkout-result"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{checkoutMsg.text}</p>}
            <Link href="/insaat-magaza/teklif" className={cn(btn, "w-full border border-border/60 hover:border-primary")} data-testid="link-cart-quote"><FileText className="h-4 w-4" />{c.qTitle}</Link>
          </aside>
        </div>
      )}
    </StoreShell>
  );
}

export function ConstructionQuotePage() {
  const { locale } = useI18n();
  const c = T[locale];
  const search = useSearch();
  const sp = useMemo(() => new URLSearchParams(search), [search]);
  const [product, setProduct] = useState(() => sp.get("productId") ? { productId: sp.get("productId")!, variantId: sp.get("variantId") ?? undefined, title: sp.get("title") ?? "", variant: sp.get("variant") ?? "" } : null);
  const [f, setF] = useState({ quantity: sp.get("quantity") ?? "1", dimensions: "", deliveryLocation: "", contactName: "", contactEmail: "", contactPhone: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<ConstructionQuoteReference | null>(null);
  const create = useCreateConstructionQuote();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const quantity = Number(f.quantity);
    if (!(quantity >= 1) || !f.dimensions.trim() || !f.deliveryLocation.trim() || !f.contactName.trim() || !f.contactEmail.trim() || !f.contactPhone.trim()) return setErr(c.required);
    if (!/^\S+@\S+\.\S+$/.test(f.contactEmail.trim())) return setErr(c.badEmail);
    if (f.contactPhone.trim().length < 5) return setErr(c.badPhone);
    setErr(null);
    create.mutate({ data: {
      quantity: Math.floor(quantity), dimensions: f.dimensions.trim(), deliveryLocation: f.deliveryLocation.trim(),
      contactName: f.contactName.trim(), contactEmail: f.contactEmail.trim(), contactPhone: f.contactPhone.trim(),
      ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
      ...(product ? { productId: product.productId, ...(product.variantId ? { variantId: product.variantId } : {}) } : {}),
    } }, { onSuccess: setDone, onError: () => setErr(c.sendErr) });
  };

  if (done) return (
    <StoreShell>
      <div className="max-w-lg mx-auto text-center py-16 border border-border/40 bg-card px-6">
        <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-4" />
        <h1 className="text-3xl font-serif italic mb-3">{c.okT}</h1>
        <p className="text-muted-foreground mb-6">{c.okD}</p>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{c.ref}</p>
        <p className="font-mono text-2xl font-semibold mt-1 select-all" data-testid="text-quote-reference">{done.reference}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <button type="button" onClick={() => { setDone(null); setF((s) => ({ ...s, dimensions: "", notes: "" })); }} className={cn(btn, "border border-border/60")} data-testid="button-new-quote">{c.another}</button>
          <Link href="/insaat-magaza" className={cn(btn, "bg-primary text-primary-foreground")}>{c.browse}</Link>
        </div>
      </div>
    </StoreShell>
  );

  const field = (k: keyof typeof f, label: string, props: Record<string, unknown> = {}) => (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{label}{k !== "notes" && <span className="text-primary" aria-hidden> *</span>}</span>
      <input value={f[k]} onChange={set(k)} className={input} data-testid={`input-quote-${k}`} required={k !== "notes"} {...props} />
    </label>
  );

  return (
    <StoreShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-serif italic mb-3">{c.qTitle}</h1>
        <p className="text-muted-foreground mb-8">{c.qDesc}</p>
        {product && (
          <div className="flex items-center justify-between gap-4 border border-primary/40 bg-primary/5 p-4 mb-6" data-testid="text-quote-product">
            <div><p className="text-xs uppercase tracking-wider text-primary">{c.selected}</p><p className="font-medium">{product.title}{product.variant && product.variant !== "Default Title" ? ` · ${product.variant}` : ""}</p></div>
            <button type="button" onClick={() => setProduct(null)} className="min-h-11 px-3 text-sm underline" data-testid="button-clear-product">{c.clear}</button>
          </div>
        )}
        <form onSubmit={submit} noValidate className="grid sm:grid-cols-2 gap-5">
          {field("quantity", c.fQty, { type: "number", min: 1, inputMode: "numeric" })}
          {field("deliveryLocation", c.fLoc, { placeholder: c.fLocH, maxLength: 500 })}
          <label className="block sm:col-span-2">
            <span className="block text-sm font-medium mb-1.5">{c.fDim}<span className="text-primary" aria-hidden> *</span></span>
            <textarea value={f.dimensions} onChange={set("dimensions")} placeholder={c.fDimH} maxLength={500} rows={3} required className={cn(input, "py-2")} data-testid="input-quote-dimensions" />
          </label>
          {field("contactName", c.fName, { autoComplete: "name", maxLength: 200 })}
          {field("contactPhone", c.fPhone, { type: "tel", autoComplete: "tel", maxLength: 60 })}
          <div className="sm:col-span-2">{field("contactEmail", c.fEmail, { type: "email", autoComplete: "email" })}</div>
          <label className="block sm:col-span-2">
            <span className="block text-sm font-medium mb-1.5">{c.fNotes}</span>
            <textarea value={f.notes} onChange={set("notes")} maxLength={2000} rows={4} className={cn(input, "py-2")} data-testid="input-quote-notes" />
          </label>
          {err && <p className="sm:col-span-2 text-sm text-destructive" role="alert" data-testid="status-quote-error">{err}</p>}
          <button type="submit" disabled={create.isPending} className={cn(btn, "sm:col-span-2 bg-primary text-primary-foreground hover:bg-primary/90")} data-testid="button-submit-quote">
            <FileText className="h-4 w-4" />{create.isPending ? c.sending : c.send}
          </button>
        </form>
      </div>
    </StoreShell>
  );
}
