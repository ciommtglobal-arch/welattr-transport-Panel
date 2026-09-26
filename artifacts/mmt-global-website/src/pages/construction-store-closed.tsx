import { Link } from 'wouter';
import { useI18n, type Locale } from '@/lib/i18n';

const content: Record<Locale, { title: string; description: string; home: string }> = {
  tr: {
    title: 'İnşaat ürünleri mağazası kapalı',
    description: 'Mezopotamya Build ürün, sepet ve teklif işlemleri şu anda kullanıma kapalıdır. Mevcut kayıtlar korunmaktadır.',
    home: 'MMT Global ana sayfasına dön',
  },
  en: {
    title: 'Construction products store is closed',
    description: 'Mezopotamya Build product, cart, and quote services are currently unavailable. Existing records are preserved.',
    home: 'Return to MMT Global',
  },
  ar: {
    title: 'متجر مواد البناء مغلق',
    description: 'منتجات Mezopotamya Build والسلة وطلبات عروض الأسعار غير متاحة حاليًا. السجلات الحالية محفوظة.',
    home: 'العودة إلى MMT Global',
  },
  ru: {
    title: 'Магазин строительных товаров закрыт',
    description: 'Товары, корзина и запросы предложений Mezopotamya Build сейчас недоступны. Существующие записи сохранены.',
    home: 'Вернуться на главную MMT Global',
  },
};

export default function ConstructionStoreClosedPage() {
  const { locale } = useI18n();
  const text = content[locale];

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#101923] px-6 py-16 text-white">
      <div className="w-full max-w-xl border border-white/20 bg-[#15202d] p-8 sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff842e]">Mezopotamya Build</p>
        <h1 className="mt-5 text-3xl font-semibold leading-tight">{text.title}</h1>
        <p className="mt-5 leading-7 text-white/70">{text.description}</p>
        <Link href="/" className="mt-8 inline-flex border border-[#ff842e] px-5 py-3 text-sm font-medium text-[#ff842e] hover:bg-[#ff842e] hover:text-[#101923]">
          {text.home}
        </Link>
      </div>
    </main>
  );
}