import { useEffect, type ReactNode } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  ChevronRight,
  CircleCheck,
  Globe2,
  LayoutGrid,
  Megaphone,
  Truck,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getLocaleCopy, type CoreLocale } from "@/lib/locale-copy";

type DepartmentSlug = "finans" | "medya" | "lojistik" | "b2b";

type DepartmentCopy = {
  label: string;
  title: string;
  lead: string;
  description: string;
  ready: string;
  responsibilities: string[];
  cta: string;
  href: string;
};

type Copy = {
  home: string;
  departmentsLabel: string;
  network: string;
  payment: string;
  contact: string;
  back: string;
  explore: string;
  overviewKicker: string;
  overviewTitle: string;
  overviewAccent: string;
  overviewDescription: string;
  networkKicker: string;
  networkTitle: string;
  networkDescription: string;
  contactCta: string;
  footerLine: string;
  departmentItems: Record<DepartmentSlug, DepartmentCopy>;
};

const copy: Record<CoreLocale, Copy> = {
  tr: {
    home: "Ana sayfa",
    departmentsLabel: "Birimler",
    network: "B2B ağı",
    payment: "Ödeme",
    contact: "İletişim",
    back: "Birimlere dön",
    explore: "Alanı incele",
    overviewKicker: "MMT Global / çalışma alanları",
    overviewTitle: "Aynı ağda,",
    overviewAccent: "net sorumluluklar.",
    overviewDescription:
      "MMT Global; lojistik, finans, medya ve üretici bağlantılarını tek bir ticari yapı içinde buluşturur. Her birim, bir sonraki güvenilir bağlantıyı kurmak için çalışır.",
    networkKicker: "Ücretsiz B2B ağı",
    networkTitle: "Bağlantı kurmak için doğru kapı.",
    networkDescription:
      "Üreticiler, alıcılar, lojistik hizmet sağlayıcıları ve işletmeler için temel B2B bağlantı hizmetimiz ücretsizdir. İhtiyacınızı paylaşın; ilgili ekip süreci netleştirsin.",
    contactCta: "MMT ile iletişime geç",
    footerLine: "Güvenilir bağlantılar. Açık sorumluluklar.",
    departmentItems: {
      finans: {
        label: "Finans",
        title: "Ödeme ve finans takibi",
        lead: "Finans ekibi hazır.",
        description:
          "Ödeme talepleri, POS akışları ve finansal başvurular için doğru işlem adımını görünür kılar; ticari süreçlerin açık ilerlemesine yardımcı olur.",
        ready:
          "Finans ekibi; ödeme, sanal POS ve başvuru takibini karşılamak için hazır.",
        responsibilities: [
          "POS ve ödeme adımlarının takibi",
          "Ticari ödeme taleplerinin yönlendirilmesi",
          "Finansal başvuruların incelenmesi",
        ],
        cta: "Ödeme sayfasına git",
        href: "/odeme",
      },
      medya: {
        label: "Medya & marka",
        title: "Markanın reklam ve içerik yüzü",
        lead: "Medya tarafı hazır.",
        description:
          "MMT Global’in reklam, duyuru ve içerik tarafını yönetir; iş alanlarının doğru bağlamla anlatılmasını ve yayın akışının sorumlulukla ilerlemesini destekler.",
        ready:
          "Medya ve reklam ekibi, markanın içerik yüzünü ve yayın hazırlığını üstlenmeye hazır.",
        responsibilities: [
          "Marka ve reklam içeriğinin hazırlanması",
          "Duyuru ve medya yayınlarının takibi",
          "Birimlerden gelen bilgilerin editoryal düzeni",
        ],
        cta: "İletişim kur",
        href: "/iletisim",
      },
      lojistik: {
        label: "Lojistik",
        title: "Rota, kapasite ve operasyon",
        lead: "Operasyon sahada netleşir.",
        description:
          "Lojistik birimi; taşıma ihtiyaçlarını, rotaları ve hizmet bağlantılarını ticari ağın doğru taraflarıyla buluşturur.",
        ready:
          "Lojistik operasyon, taşıma ihtiyacını görünür kılmak ve uygun bağlantıyı kurmak için hazır.",
        responsibilities: [
          "Rota ve taşıma ihtiyacının değerlendirilmesi",
          "Hizmet sağlayıcı bağlantılarının kurulması",
          "Operasyonel bilgi ve duyuruların takibi",
        ],
        cta: "Lojistik merkezine git",
        href: "/lojistik",
      },
      b2b: {
        label: "B2B ağı",
        title: "Üretici ve alıcı bağlantıları",
        lead: "Ticari bağlantı açık.",
        description:
          "Ücretsiz B2B ağı; üreticileri, alıcıları, lojistik ekiplerini ve hizmet sağlayıcıları onaylı ilanlar etrafında bir araya getirir.",
        ready:
          "B2B ağı, işletme profillerini ve ihtiyaçları doğru bağlantıya taşımaya hazır.",
        responsibilities: [
          "Üretici ve işletme profillerinin görünürlüğü",
          "Alıcı taleplerinin ilgili tarafa aktarılması",
          "Onaylı ilanlar üzerinden güvenilir eşleşme",
        ],
        cta: "B2B ağını keşfet",
        href: "/b2b-agi",
      },
    },
  },
  en: {
    home: "Home",
    departmentsLabel: "Departments",
    network: "B2B network",
    payment: "Payment",
    contact: "Contact",
    back: "Back to departments",
    explore: "Explore area",
    overviewKicker: "MMT Global / operating areas",
    overviewTitle: "One network,",
    overviewAccent: "clear ownership.",
    overviewDescription:
      "MMT Global brings logistics, finance, media and producer connections into one commercial structure. Each department works toward the next reliable connection.",
    networkKicker: "Free B2B network",
    networkTitle: "A clear door to the right connection.",
    networkDescription:
      "Our core B2B connection service is free for producers, buyers, logistics providers and businesses. Share what you need and let the relevant team clarify the next step.",
    contactCta: "Contact MMT",
    footerLine: "Reliable connections. Clear ownership.",
    departmentItems: {
      finans: {
        label: "Finance",
        title: "Payment and finance follow-up",
        lead: "The finance team is ready.",
        description:
          "The finance team makes payment requests, POS flows and finance applications easier to route, helping commercial processes move with clarity.",
        ready:
          "The finance team is ready to support payment, virtual POS and application follow-up.",
        responsibilities: [
          "POS and payment step follow-up",
          "Routing commercial payment requests",
          "Reviewing finance applications",
        ],
        cta: "Go to payment",
        href: "/odeme",
      },
      medya: {
        label: "Media & brand",
        title: "The advertising and content face of the brand",
        lead: "The media side is ready.",
        description:
          "The media function manages MMT Global’s advertising, announcements and content side, helping each business area be explained with the right context.",
        ready:
          "The media and advertising team is ready to own the brand’s content face and publishing preparation.",
        responsibilities: [
          "Preparing brand and advertising content",
          "Following announcements and media publishing",
          "Editorial organization of department information",
        ],
        cta: "Start a conversation",
        href: "/iletisim",
      },
      lojistik: {
        label: "Logistics",
        title: "Routes, capacity and operations",
        lead: "Operations become clear on the ground.",
        description:
          "The logistics department brings transport needs, routes and service connections together with the right sides of the commercial network.",
        ready:
          "Logistics operations are ready to make transport needs visible and build the right connection.",
        responsibilities: [
          "Assessing routes and transport needs",
          "Building service-provider connections",
          "Following operational information and announcements",
        ],
        cta: "Go to logistics hub",
        href: "/lojistik",
      },
      b2b: {
        label: "B2B network",
        title: "Producer and buyer connections",
        lead: "The trade connection is open.",
        description:
          "The free B2B network brings producers, buyers, logistics teams and service providers together around approved listings.",
        ready:
          "The B2B network is ready to move business profiles and needs toward the right connection.",
        responsibilities: [
          "Visibility for producer and business profiles",
          "Routing buyer requests to the relevant side",
          "Reliable matching through approved listings",
        ],
        cta: "Explore the B2B network",
        href: "/b2b-agi",
      },
    },
  },
  ar: {
    home: "الرئيسية",
    departmentsLabel: "الأقسام",
    network: "شبكة B2B",
    payment: "الدفع",
    contact: "اتصل بنا",
    back: "العودة إلى الأقسام",
    explore: "استكشف القسم",
    overviewKicker: "MMT Global / مجالات العمل",
    overviewTitle: "شبكة واحدة،",
    overviewAccent: "مسؤوليات واضحة.",
    overviewDescription:
      "تجمع MMT Global الخدمات اللوجستية والمالية والإعلام وروابط المنتجين ضمن هيكل تجاري واحد. يعمل كل قسم على بناء الاتصال الموثوق التالي.",
    networkKicker: "شبكة B2B مجانية",
    networkTitle: "الباب الواضح إلى الاتصال الصحيح.",
    networkDescription:
      "خدمة اتصال B2B الأساسية مجانية للمنتجين والمشترين ومقدمي الخدمات اللوجستية والشركات. شارك احتياجك ودع القسم المعني يوضح الخطوة التالية.",
    contactCta: "تواصل مع MMT",
    footerLine: "اتصالات موثوقة. مسؤوليات واضحة.",
    departmentItems: {
      finans: {
        label: "المالية",
        title: "متابعة الدفع والمالية",
        lead: "الفريق المالي مستعد.",
        description:
          "يوضح الفريق المالي مسار طلبات الدفع وتدفقات نقاط البيع وطلبات التمويل، ويساعد العمليات التجارية على التقدم بوضوح.",
        ready: "الفريق المالي مستعد لمتابعة الدفع ونقاط البيع الافتراضية والطلبات.",
        responsibilities: [
          "متابعة خطوات نقاط البيع والدفع",
          "توجيه طلبات الدفع التجارية",
          "مراجعة الطلبات المالية",
        ],
        cta: "انتقل إلى الدفع",
        href: "/odeme",
      },
      medya: {
        label: "الإعلام والعلامة",
        title: "واجهة الإعلان والمحتوى للعلامة",
        lead: "الجانب الإعلامي مستعد.",
        description:
          "يدير قسم الإعلام الإعلان والإشعارات والمحتوى في MMT Global، ويساعد على شرح كل مجال بالسياق الصحيح.",
        ready: "فريق الإعلام والإعلان مستعد لتولي واجهة المحتوى وتجهيز النشر.",
        responsibilities: [
          "إعداد محتوى العلامة والإعلان",
          "متابعة الإشعارات والنشر الإعلامي",
          "تنظيم معلومات الأقسام تحريرياً",
        ],
        cta: "ابدأ محادثة",
        href: "/iletisim",
      },
      lojistik: {
        label: "اللوجستيات",
        title: "الطرق والقدرة التشغيلية",
        lead: "تتضح العمليات في الميدان.",
        description:
          "يجمع قسم اللوجستيات احتياجات النقل والطرق وروابط الخدمات مع الأطراف الصحيحة في الشبكة التجارية.",
        ready: "العمليات اللوجستية مستعدة لإظهار احتياج النقل وبناء الاتصال المناسب.",
        responsibilities: [
          "تقييم الطرق واحتياجات النقل",
          "بناء روابط مقدمي الخدمات",
          "متابعة المعلومات والإعلانات التشغيلية",
        ],
        cta: "انتقل إلى المركز اللوجستي",
        href: "/lojistik",
      },
      b2b: {
        label: "شبكة B2B",
        title: "روابط المنتجين والمشترين",
        lead: "الاتصال التجاري مفتوح.",
        description:
          "تجمع شبكة B2B المجانية المنتجين والمشترين وفرق اللوجستيات ومقدمي الخدمات حول إعلانات معتمدة.",
        ready: "شبكة B2B مستعدة لتوجيه ملفات الشركات والاحتياجات إلى الاتصال الصحيح.",
        responsibilities: [
          "إظهار ملفات المنتجين والشركات",
          "توجيه طلبات المشترين إلى الطرف المعني",
          "مطابقة موثوقة عبر الإعلانات المعتمدة",
        ],
        cta: "استكشف شبكة B2B",
        href: "/b2b-agi",
      },
    },
  },
  ru: {
    home: "Главная",
    departmentsLabel: "Отделы",
    network: "B2B-сеть",
    payment: "Оплата",
    contact: "Контакты",
    back: "Назад к отделам",
    explore: "Открыть направление",
    overviewKicker: "MMT Global / направления работы",
    overviewTitle: "Одна сеть,",
    overviewAccent: "понятная ответственность.",
    overviewDescription:
      "MMT Global объединяет логистику, финансы, медиа и связи с производителями в одной коммерческой структуре. Каждый отдел отвечает за следующий надёжный контакт.",
    networkKicker: "Бесплатная B2B-сеть",
    networkTitle: "Понятный путь к нужному контакту.",
    networkDescription:
      "Основная B2B-связь бесплатна для производителей, покупателей, логистических компаний и бизнеса. Опишите потребность, а нужный отдел уточнит следующий шаг.",
    contactCta: "Связаться с MMT",
    footerLine: "Надёжные связи. Понятная ответственность.",
    departmentItems: {
      finans: {
        label: "Финансы",
        title: "Платежи и финансовое сопровождение",
        lead: "Финансовая команда готова.",
        description:
          "Финансовая команда упорядочивает платежные запросы, процессы POS и финансовые заявки, помогая коммерческим операциям двигаться прозрачно.",
        ready: "Финансовая команда готова сопровождать платежи, виртуальный POS и заявки.",
        responsibilities: [
          "Сопровождение шагов POS и оплаты",
          "Направление коммерческих платежных запросов",
          "Проверка финансовых заявок",
        ],
        cta: "Перейти к оплате",
        href: "/odeme",
      },
      medya: {
        label: "Медиа и бренд",
        title: "Рекламное и контентное лицо бренда",
        lead: "Медиа-направление готово.",
        description:
          "Медиа-функция отвечает за рекламу, объявления и контент MMT Global, помогая рассказывать о каждом направлении в правильном контексте.",
        ready: "Медиа- и рекламная команда готова отвечать за контент и подготовку публикаций.",
        responsibilities: [
          "Подготовка брендового и рекламного контента",
          "Сопровождение объявлений и медиапубликаций",
          "Редакционная организация информации отделов",
        ],
        cta: "Начать разговор",
        href: "/iletisim",
      },
      lojistik: {
        label: "Логистика",
        title: "Маршруты, мощности и операции",
        lead: "Операции становятся ясными на практике.",
        description:
          "Логистический отдел соединяет транспортные потребности, маршруты и сервисные связи с нужными сторонами коммерческой сети.",
        ready: "Логистическая команда готова сделать транспортную потребность видимой и найти связь.",
        responsibilities: [
          "Оценка маршрутов и транспортных потребностей",
          "Связь с поставщиками услуг",
          "Сопровождение операционной информации и объявлений",
        ],
        cta: "Перейти в логистический центр",
        href: "/lojistik",
      },
      b2b: {
        label: "B2B-сеть",
        title: "Связи производителей и покупателей",
        lead: "Торговая связь открыта.",
        description:
          "Бесплатная B2B-сеть объединяет производителей, покупателей, логистические команды и поставщиков услуг вокруг проверенных объявлений.",
        ready: "B2B-сеть готова направлять профили компаний и потребности к нужному контакту.",
        responsibilities: [
          "Видимость профилей производителей и компаний",
          "Передача запросов покупателей нужной стороне",
          "Надёжное сопоставление через проверенные объявления",
        ],
        cta: "Открыть B2B-сеть",
        href: "/b2b-agi",
      },
    },
  },
};

const departmentIcons: Record<DepartmentSlug, typeof Banknote> = {
  finans: Banknote,
  medya: Megaphone,
  lojistik: Truck,
  b2b: Globe2,
};

function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    let descriptionTag = document.querySelector('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.setAttribute("name", "description");
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute("content", description);
  }, [description, title]);
}

function BrandMark() {
  return (
    <Link href="/" data-testid="link-departments-home" className="group flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-br-2xl rounded-tl-2xl bg-primary text-lg font-bold text-primary-foreground transition-transform group-hover:scale-95">
        M
      </span>
      <span className="text-sm font-bold tracking-[0.18em]">
        MMT <span className="font-normal text-foreground/55">GLOBAL</span>
      </span>
    </Link>
  );
}

function SiteHeader({ current, labels }: { current?: string; labels: Copy }) {
  const links = [
    { href: "/", label: labels.home, id: "home" },
    { href: "/birimler", label: labels.departmentsLabel, id: "departments" },
    { href: "/b2b-agi", label: labels.network, id: "network" },
    { href: "/odeme", label: labels.payment, id: "payment" },
    { href: "/iletisim", label: labels.contact, id: "contact" },
  ];
  return (
    <header className="border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-5 md:px-10">
        <BrandMark />
        <nav aria-label={labels.departmentsLabel} className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {links.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              data-testid={`link-nav-${link.id}`}
              className={`text-[11px] font-bold uppercase tracking-[0.13em] transition-colors ${
                current === link.id ? "text-primary" : "text-foreground/55 hover:text-primary"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Footer({ labels }: { labels: Copy }) {
  return (
    <footer className="border-t border-border/70 bg-[#0e151d] text-[#f5efe7]">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-9 md:flex-row md:items-end md:justify-between md:px-10">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">MMT Global</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[#f5efe7]/55">{labels.footerLine}</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-3 text-xs font-semibold text-[#f5efe7]/65">
          <Link href="/" data-testid="link-footer-home" className="transition-colors hover:text-primary">{labels.home}</Link>
          <Link href="/birimler" data-testid="link-footer-departments" className="transition-colors hover:text-primary">{labels.departmentsLabel}</Link>
          <Link href="/b2b-agi" data-testid="link-footer-network" className="transition-colors hover:text-primary">{labels.network}</Link>
          <Link href="/odeme" data-testid="link-footer-payment" className="transition-colors hover:text-primary">{labels.payment}</Link>
          <Link href="/iletisim" data-testid="link-footer-contact" className="transition-colors hover:text-primary">{labels.contact}</Link>
        </div>
      </div>
    </footer>
  );
}

function DepartmentIcon({ slug, size = 22 }: { slug: DepartmentSlug; size?: number }) {
  const Icon = departmentIcons[slug];
  return <Icon size={size} strokeWidth={1.7} />;
}

function DepartmentCard({
  slug,
  item,
  labels,
  featured = false,
}: {
  slug: DepartmentSlug;
  item: DepartmentCopy;
  labels: Copy;
  featured?: boolean;
}) {
  return (
    <article
      className={`group relative overflow-hidden border p-6 transition-transform duration-300 hover:-translate-y-1 md:p-8 ${
        featured ? "border-primary/45 bg-primary text-primary-foreground md:col-span-2" : "border-border bg-card"
      }`}
      data-testid={`card-department-${slug}`}
    >
      <div className="flex items-start justify-between gap-5">
        <span className={`flex h-11 w-11 items-center justify-center rounded-full border ${
          featured ? "border-primary-foreground/25 bg-primary-foreground/10" : "border-primary/25 bg-primary/10 text-primary"
        }`}>
          <DepartmentIcon slug={slug} />
        </span>
        <span className={`font-mono text-[10px] uppercase tracking-[0.18em] ${featured ? "text-primary-foreground/60" : "text-foreground/40"}`}>
          0{Object.keys(labels.departmentItems).indexOf(slug) + 1}
        </span>
      </div>
      <p className={`mt-10 text-[10px] font-bold uppercase tracking-[0.2em] ${featured ? "text-primary-foreground/65" : "text-primary"}`}>
        {item.label}
      </p>
      <h2 className={`mt-3 max-w-xl text-3xl font-semibold leading-[1.04] tracking-tight ${featured ? "" : "text-foreground"}`}>
        {item.title}
      </h2>
      <p className={`mt-4 max-w-xl text-sm leading-7 ${featured ? "text-primary-foreground/75" : "text-foreground/58"}`}>
        {item.description}
      </p>
      <Link
        href={`/birimler/${slug}`}
        data-testid={`link-department-${slug}`}
        className={`mt-8 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] transition-colors ${
          featured ? "text-primary-foreground hover:text-white" : "text-primary hover:text-foreground"
        }`}
      >
        {labels.explore}
        <ArrowUpRight size={15} />
      </Link>
      {featured ? <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full border border-primary-foreground/10" /> : null}
    </article>
  );
}

export default function DepartmentsOverviewPage() {
  const { locale } = useI18n();
  const labels = getLocaleCopy(copy, locale);
  usePageMeta(
    `${labels.departmentsLabel} | MMT Global`,
    labels.overviewDescription,
  );

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <SiteHeader current="departments" labels={labels} />
      <section className="relative overflow-hidden border-b border-border/70 bg-[#111a23] text-[#f5efe7]">
        <div className="absolute right-[-8rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full border border-primary/20" />
        <div className="absolute bottom-[-12rem] left-[42%] h-[25rem] w-[25rem] rounded-full border border-primary/10" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-[1.1fr_0.9fr] md:px-10 md:py-28">
          <div className="animate-slide-up-fade opacity-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">{labels.overviewKicker}</p>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.04em] md:text-8xl">
              {labels.overviewTitle}
              <span className="block font-serif font-normal italic text-primary">{labels.overviewAccent}</span>
            </h1>
            <p className="mt-8 max-w-2xl text-base leading-8 text-[#f5efe7]/65 md:text-lg">{labels.overviewDescription}</p>
          </div>
          <div className="flex items-end justify-start md:justify-end">
            <div className="max-w-xs border-l border-primary/60 pl-5">
              <LayoutGrid className="mb-6 text-primary" size={28} strokeWidth={1.4} />
              <p className="text-sm leading-7 text-[#f5efe7]/65">{labels.networkDescription}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 md:px-10 md:py-24">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">01 / {labels.departmentsLabel}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">{labels.overviewAccent}</h2>
          </div>
          <BadgeCheck className="hidden text-primary md:block" size={30} strokeWidth={1.5} />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <DepartmentCard slug="finans" item={labels.departmentItems.finans} labels={labels} featured />
          <DepartmentCard slug="medya" item={labels.departmentItems.medya} labels={labels} />
          <DepartmentCard slug="lojistik" item={labels.departmentItems.lojistik} labels={labels} />
          <DepartmentCard slug="b2b" item={labels.departmentItems.b2b} labels={labels} />
        </div>
      </section>

      <section className="border-y border-border/70 bg-secondary text-secondary-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[0.8fr_1.2fr] md:px-10 md:py-20">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">{labels.networkKicker}</p>
            <h2 className="mt-4 max-w-md text-3xl font-semibold leading-tight md:text-5xl">{labels.networkTitle}</h2>
          </div>
          <div className="flex flex-col items-start justify-between gap-8">
            <p className="max-w-2xl text-base leading-8 text-secondary-foreground/65">{labels.networkDescription}</p>
            <Link href="/b2b-agi" data-testid="link-overview-network-cta" className="inline-flex items-center gap-3 bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-primary/85">
              {labels.network}
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <Footer labels={labels} />
    </main>
  );
}

export function DepartmentPage() {
  const { locale } = useI18n();
  const labels = getLocaleCopy(copy, locale);
  const params = useParams<{ slug?: string }>();
  const slug = params.slug as DepartmentSlug;
  const item = labels.departmentItems[slug];
  usePageMeta(
    item ? `${item.label} | MMT Global` : `${labels.departmentsLabel} | MMT Global`,
    item?.description ?? labels.overviewDescription,
  );

  if (!item) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6 text-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{labels.departmentsLabel}</p>
          <h1 className="mt-4 text-4xl font-semibold">{labels.overviewTitle} {labels.overviewAccent}</h1>
          <Link href="/birimler" data-testid="link-invalid-department-back" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <ArrowLeft size={16} />
            {labels.back}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <SiteHeader current="departments" labels={labels} />
      <section className="border-b border-border/70 bg-[#111a23] text-[#f5efe7]">
        <div className="mx-auto max-w-7xl px-5 py-12 md:px-10 md:py-16">
          <Link href="/birimler" data-testid="link-department-back" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[#f5efe7]/55 transition-colors hover:text-primary">
            <ArrowLeft size={15} />
            {labels.back}
          </Link>
          <div className="mt-14 grid gap-12 md:grid-cols-[1.2fr_0.8fr] md:items-end">
            <div>
              <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-primary">
                <DepartmentIcon slug={slug} size={16} />
                {item.label}
              </p>
              <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[0.96] tracking-[-0.04em] md:text-8xl">{item.title}</h1>
            </div>
            <p className="border-l border-primary/60 pl-5 text-base leading-8 text-[#f5efe7]/65">{item.description}</p>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-14 md:grid-cols-[0.85fr_1.15fr] md:px-10 md:py-24">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">02 / {item.label}</p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">{item.lead}</h2>
          <p className="mt-6 max-w-md text-base leading-8 text-foreground/60">{item.ready}</p>
          <Link href={item.href} data-testid={`link-department-primary-${slug}`} className="mt-8 inline-flex items-center gap-3 bg-primary px-6 py-4 text-xs font-bold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-primary/85">
            {item.cta}
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="border-t border-border/70">
          {item.responsibilities.map((responsibility, index) => (
            <div key={responsibility} className="flex gap-5 border-b border-border/70 py-6" data-testid={`text-responsibility-${slug}-${index}`}>
              <CircleCheck className="mt-0.5 shrink-0 text-primary" size={19} strokeWidth={1.7} />
              <p className="text-base font-medium leading-7">{responsibility}</p>
            </div>
          ))}
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/b2b-agi" data-testid={`link-department-network-${slug}`} className="inline-flex items-center gap-2 border border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors hover:border-primary hover:text-primary">
              {labels.network}
              <ChevronRight size={15} />
            </Link>
            <Link href="/iletisim" data-testid={`link-department-contact-${slug}`} className="inline-flex items-center gap-2 border border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors hover:border-primary hover:text-primary">
              {labels.contact}
              <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </section>
      <Footer labels={labels} />
    </main>
  );
}