import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowDownRight, Menu, X, ArrowRight, Globe2, Building2, Stethoscope, Truck, Tv, Briefcase, Factory, Share2, Instagram, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import CorporateFleetSection from "@/components/corporate-fleet-section";
import { useI18n, type Locale } from "@/lib/i18n";

const staffLabels: Record<Locale, { login: string; media: string }> = {
  tr: { login: "Personel Girişi", media: "Medya Merkezi" },
  en: { login: "Staff Sign In", media: "Media Center" },
  ar: { login: "دخول الموظفين", media: "المركز الإعلامي" },
  ru: { login: "Вход для сотрудников", media: "Медиацентр" },
};

// Make sure to use the generated image
const HERO_BG = "/hero-bridge.jpg";
const BUSINESS_CONTACTS_READY = false;
const OFFICIAL_SOCIAL_CHANNELS = [
  {
    platform: "Instagram",
    handle: "@mmtglobalofficialtr",
    href: "https://www.instagram.com/mmtglobalofficialtr/",
    icon: Instagram,
  },
  {
    platform: "TikTok",
    handle: "@mmtglobalofficialtr",
    href: "https://www.tiktok.com/@mmtglobalofficialtr",
    icon: Music2,
  },
] as const;

const homeCopy: Record<Locale, {
  navApproach: string;
  navEcosystem: string;
  navDepartments: string;
  navFleet: string;
  navContact: string;
  navB2B: string;
  home: string;
  registerCompany: string;
  inviteTeam: string;
  companyPanel: string;
  portal: string;
  wallet: string;
  payment: string;
  categories: string;
  categoryCommercial: string;
  categoryHousing: string;
  categoryVehicle: string;
  categoryIndividual: string;
  allApplications: string;
  heroKicker: string;
  produce: string;
  promote: string;
  sell: string;
  heroDescriptionStrong: string;
  heroDescription: string;
  joinNetwork: string;
  discover: string;
  approach: string;
  approachTitle: string;
  approachDescription: string;
  discoverStory: string;
  roadmap: string;
  roadmapTitle: string;
  roadmapDescription: string;
  roadmapProduceDescription: string;
  roadmapPromoteDescription: string;
  roadmapSellDescription: string;
  ecosystem: string;
  contactTitle: string;
  contactTitleEmphasis: string;
  contactDescription: string;
  whatsapp: string;
  pageShare: string;
  officialChannels: string;
  officialChannelsDescription: string;
  officialChannelsPending: string;
  quickLinks: string;
  about: string;
  contactPage: string;
  investments: string;
  career: string;
  legalAndPayment: string;
  serviceTerms: string;
  refund: string;
  delivery: string;
  distanceSales: string;
  ecosystemTitle: string;
  logistics: string;
  healthTourism: string;
  construction: string;
  financeMedia: string;
  footerDescription: string;
  contact: string;
  contactPending: string;
  privacy: string;
  cookies: string;
  kvkk: string;
  floatingAction: string;
}> = {
  tr: {
    navApproach: "BAKIŞ AÇIMIZ", navEcosystem: "EKOSİSTEM", navDepartments: "BİRİMLER", navFleet: "KURUMSAL FİLO", navContact: "İLETİŞİM", navB2B: "ÜCRETSİZ B2B AĞI", home: "ANA SAYFA", registerCompany: "FİRMA KAYDI", inviteTeam: "DAVET ET", companyPanel: "FİRMA PANELİM", portal: "PORTALA GİRİŞ", wallet: "DEMO CÜZDAN", payment: "TİCARİ ÖDEME",
    categories: "Başvuru kategorileri", categoryCommercial: "Ticari", categoryHousing: "Konut", categoryVehicle: "Taşıt", categoryIndividual: "Bireysel", allApplications: "TÜM BAŞVURULAR",
    heroKicker: "MMT GLOBAL / ÜCRETSİZ B2B İŞ AĞI", produce: "Üret.", promote: "Tanıt.", sell: "Sat.", heroDescriptionStrong: "Firmanı tanıt, iş bağlantıları kur, ekibini tek yerden yönet.", heroDescription: "Üretici tanıtımı, alıcı talepleri ve temel B2B bağlantı hizmetleri ücretsizdir.", joinNetwork: "İŞ AĞINI KEŞFET", discover: "AĞI KEŞFETMEK İÇİN KAYDIR",
    approach: "BAKIŞ AÇIMIZ", approachTitle: "Birlikte Büyüyoruz", approachDescription: "MMT Global olarak üreticilerin, alıcıların, lojistik ekiplerinin ve hizmet verenlerin birbirini bulabildiği ücretsiz bir B2B ağı kuruyoruz. Önce güvenilir bağlantılar ve sosyal fayda; sonra birlikte büyüyen sürdürülebilir bir marka.", discoverStory: "HİKAYEMİZİ KEŞFET", roadmap: "YOL HARİTAMIZ", roadmapTitle: "Üret. Tanıt. Sat.", roadmapDescription: "Takipçilerimiz ve üyelerimiz için adım adım ilerliyoruz. Temel tanıtım ve bağlantı hizmetlerine erişim ücretsiz kalır.", roadmapProduceDescription: "Üreticilerin ve hizmet verenlerin kendilerini, ürünlerini ve yetkinliklerini görünür kılmasına yardımcı oluruz.", roadmapPromoteDescription: "Üretici tanıtımlarını ve alıcı taleplerini güvenilir bilgilerle paylaşır, doğru kişilerin birbirini bulmasını kolaylaştırırız.", roadmapSellDescription: "Alıcı, üretici ve lojistik taraflarını buluşturarak şeffaf ve gerçekçi ticari bağlantıların kurulmasına zemin hazırlarız.",
     ecosystem: "EKOSİSTEM", contactTitle: "Küresel Büyümeye", contactTitleEmphasis: "Hazır Mısınız?", contactDescription: "Üreticiler, alıcılar ve hizmet verenler için ücretsiz B2B bağlantı ağı kuruyoruz. Birlikte büyüyelim.", whatsapp: "WHATSAPP'TAN YAZIN", pageShare: "BU SAYFAYI PAYLAŞIN", officialChannels: "RESMİ KANALLAR", officialChannelsDescription: "Doğrulanabilen resmî Instagram ve TikTok profillerimiz aşağıda yer alır.", officialChannelsPending: "Facebook, LinkedIn ve Telegram kanalları için doğrudan bağlantılar bekleniyor.", quickLinks: "HIZLI BAĞLANTILAR", about: "Hakkımızda", contactPage: "İletişim", investments: "Yatırımlarımız", career: "Kariyer", legalAndPayment: "YASAL VE ÖDEME", serviceTerms: "Hizmet koşulları", refund: "İade ve iptal", delivery: "Teslimat koşulları", distanceSales: "Mesafeli satış", ecosystemTitle: "EKOSİSTEM", logistics: "Lojistik", healthTourism: "Sağlık Turizmi", construction: "İnşaat & Gelişim", financeMedia: "Finans & Medya", footerDescription: "Üreticileri, alıcıları, lojistik ve hizmet taraflarını ücretsiz B2B bağlantı ağıyla buluştururuz.", contact: "İLETİŞİM", contactPending: "Resmi iletişim hattı hazırlanıyor.", privacy: "Gizlilik Politikası", cookies: "Çerez Politikası", kvkk: "KVKK", floatingAction: "Hızlı işlemler",
  },
  en: {
    navApproach: "OUR APPROACH", navEcosystem: "ECOSYSTEM", navDepartments: "DEPARTMENTS", navFleet: "CORPORATE FLEET", navContact: "CONTACT", navB2B: "FREE B2B NETWORK", home: "HOME", registerCompany: "COMPANY REGISTRATION", inviteTeam: "INVITE TEAM", companyPanel: "MY COMPANY PANEL", portal: "OPEN PORTAL", wallet: "DEMO WALLET", payment: "BUSINESS PAYMENT",
    categories: "Application categories", categoryCommercial: "Commercial", categoryHousing: "Housing", categoryVehicle: "Vehicle", categoryIndividual: "Individual", allApplications: "ALL APPLICATIONS",
    heroKicker: "MMT GLOBAL / FREE B2B NETWORK", produce: "Produce.", promote: "Promote.", sell: "Sell.", heroDescriptionStrong: "Introduce your company, build connections and manage your team in one place.", heroDescription: "Producer promotion, buyer requests and core B2B connection services are free.", joinNetwork: "EXPLORE THE NETWORK", discover: "SCROLL TO EXPLORE",
    approach: "OUR APPROACH", approachTitle: "Growing Together", approachDescription: "MMT Global is building a free B2B network where producers, buyers, logistics teams and service providers can find one another. Reliable connections and social value first; a sustainable brand that grows together next.", discoverStory: "DISCOVER OUR STORY", roadmap: "OUR ROADMAP", roadmapTitle: "Produce. Promote. Sell.", roadmapDescription: "We move forward step by step for our followers and members. Core promotion and connection services remain free.", roadmapProduceDescription: "We help producers and service providers make themselves, their products and their capabilities visible.", roadmapPromoteDescription: "We share producer introductions and buyer requests with reliable information, making it easier for the right people to find one another.", roadmapSellDescription: "We bring buyers, producers and logistics partners together to create transparent and realistic commercial connections.",
     ecosystem: "ECOSYSTEM", contactTitle: "Ready for", contactTitleEmphasis: "Global Growth?", contactDescription: "We are building a free B2B connection network for producers, buyers and service providers. Let’s grow together.", whatsapp: "MESSAGE ON WHATSAPP", pageShare: "SHARE THIS PAGE", officialChannels: "OFFICIAL CHANNELS", officialChannelsDescription: "Our verifiable official Instagram and TikTok profiles are listed below.", officialChannelsPending: "Direct links for the Facebook, LinkedIn and Telegram channels are still pending.", quickLinks: "QUICK LINKS", about: "About us", contactPage: "Contact", investments: "Investments", career: "Careers", legalAndPayment: "LEGAL & PAYMENT", serviceTerms: "Service terms", refund: "Refunds and cancellations", delivery: "Delivery terms", distanceSales: "Distance sales", ecosystemTitle: "ECOSYSTEM", logistics: "Logistics", healthTourism: "Health tourism", construction: "Construction & development", financeMedia: "Finance & media", footerDescription: "We connect producers, buyers, logistics and service providers through a free B2B network.", contact: "CONTACT", contactPending: "The official business contact line is being prepared.", privacy: "Privacy policy", cookies: "Cookie policy", kvkk: "KVKK", floatingAction: "Quick actions",
  },
  ar: {
    navApproach: "نهجنا", navEcosystem: "المنظومة", navDepartments: "الأقسام", navFleet: "الأسطول المؤسسي", navContact: "اتصل بنا", navB2B: "شبكة B2B المجانية", home: "الرئيسية", registerCompany: "تسجيل الشركة", inviteTeam: "دعوة الفريق", companyPanel: "لوحة شركتي", portal: "دخول البوابة", wallet: "محفظة تجريبية", payment: "الدفع التجاري",
    categories: "فئات الطلب", categoryCommercial: "تجاري", categoryHousing: "سكني", categoryVehicle: "مركبات", categoryIndividual: "فردي", allApplications: "كل الطلبات",
    heroKicker: "MMT GLOBAL / شبكة B2B مجانية", produce: "أنتج.", promote: "روّج.", sell: "بع.", heroDescriptionStrong: "عرّف بشركتك، وابنِ علاقات العمل، وأدر فريقك من مكان واحد.", heroDescription: "الترويج للمنتجين وطلبات المشترين وخدمات الربط الأساسية مجانية.", joinNetwork: "اكتشف شبكة الأعمال", discover: "مرر للاستكشاف",
    approach: "نهجنا", approachTitle: "ننمو معاً", approachDescription: "تبني MMT Global شبكة B2B مجانية تتيح للمنتجين والمشترين وفرق الخدمات اللوجستية ومقدمي الخدمات العثور على بعضهم. نبدأ بالروابط الموثوقة والقيمة الاجتماعية، ثم نبني علامة مستدامة تنمو معاً.", discoverStory: "اكتشف قصتنا", roadmap: "خريطة الطريق", roadmapTitle: "أنتج. روّج. بع.", roadmapDescription: "نتقدم خطوة بخطوة من أجل متابعينا وأعضائنا. تبقى خدمات التعريف والربط الأساسية مجانية.", roadmapProduceDescription: "نساعد المنتجين ومقدمي الخدمات على إبراز أنفسهم ومنتجاتهم وخبراتهم.", roadmapPromoteDescription: "نشارك تعريفات المنتجين وطلبات المشترين بمعلومات موثوقة، ونقرّب الأشخاص المناسبين من بعضهم.", roadmapSellDescription: "نربط المشترين والمنتجين وشركاء الخدمات اللوجستية لبناء روابط تجارية شفافة وواقعية.",
     ecosystem: "المنظومة", contactTitle: "هل أنتم مستعدون", contactTitleEmphasis: "للنمو العالمي؟", contactDescription: "نبني شبكة B2B مجانية لربط المنتجين والمشترين ومقدمي الخدمات. لِنَنْمُ معاً.", whatsapp: "اكتبوا عبر واتساب", pageShare: "شاركوا هذه الصفحة", officialChannels: "القنوات الرسمية", officialChannelsDescription: "تجدون أدناه حساباتنا الرسمية القابلة للتحقق على Instagram وTikTok.", officialChannelsPending: "لا تزال الروابط المباشرة لقنوات فيسبوك ولينكدإن ومجموعة تيليغرام قيد الإعداد.", quickLinks: "روابط سريعة", about: "من نحن", contactPage: "اتصل بنا", investments: "استثماراتنا", career: "الوظائف", legalAndPayment: "قانوني والدفع", serviceTerms: "شروط الخدمة", refund: "الإلغاء والاسترداد", delivery: "شروط التسليم", distanceSales: "البيع عن بُعد", ecosystemTitle: "المنظومة", logistics: "الخدمات اللوجستية", healthTourism: "السياحة الصحية", construction: "الإنشاء والتطوير", financeMedia: "المال والإعلام", footerDescription: "نربط المنتجين والمشترين والخدمات اللوجستية ومقدمي الخدمات عبر شبكة B2B مجانية.", contact: "اتصل بنا", contactPending: "يجري إعداد خط الاتصال التجاري الرسمي.", privacy: "سياسة الخصوصية", cookies: "سياسة ملفات الارتباط", kvkk: "KVKK", floatingAction: "إجراءات سريعة",
  },
  ru: {
    navApproach: "НАШ ПОДХОД", navEcosystem: "ЭКОСИСТЕМА", navDepartments: "ПОДРАЗДЕЛЕНИЯ", navFleet: "КОРПОРАТИВНЫЙ АВТОПАРК", navContact: "КОНТАКТЫ", navB2B: "БЕСПЛАТНАЯ B2B-СЕТЬ", home: "ГЛАВНАЯ", registerCompany: "РЕГИСТРАЦИЯ КОМПАНИИ", inviteTeam: "ПРИГЛАСИТЬ КОМАНДУ", companyPanel: "ПАНЕЛЬ КОМПАНИИ", portal: "ВОЙТИ В ПОРТАЛ", wallet: "ДЕМО-КОШЕЛЁК", payment: "КОММЕРЧЕСКАЯ ОПЛАТА",
    categories: "Категории заявок", categoryCommercial: "Коммерция", categoryHousing: "Жильё", categoryVehicle: "Транспорт", categoryIndividual: "Для частных лиц", allApplications: "ВСЕ ЗАЯВКИ",
    heroKicker: "MMT GLOBAL / БЕСПЛАТНАЯ B2B-СЕТЬ", produce: "Производи.", promote: "Продвигай.", sell: "Продавай.", heroDescriptionStrong: "Представляйте компанию, создавайте связи и управляйте командой в одном месте.", heroDescription: "Продвижение производителей, запросы покупателей и базовые B2B-связи бесплатны.", joinNetwork: "ИЗУЧИТЬ СЕТЬ", discover: "ЛИСТАЙТЕ ДЛЯ ОБЗОРА",
    approach: "НАШ ПОДХОД", approachTitle: "Растём вместе", approachDescription: "MMT Global создаёт бесплатную B2B-сеть, где производители, покупатели, логистические команды и поставщики услуг находят друг друга. Сначала надёжные связи и социальная польза, затем устойчивый бренд, который растёт вместе.", discoverStory: "УЗНАТЬ НАШУ ИСТОРИЮ", roadmap: "НАША ДОРОЖНАЯ КАРТА", roadmapTitle: "Производи. Продвигай. Продавай.", roadmapDescription: "Мы двигаемся шаг за шагом для наших подписчиков и участников. Базовые услуги продвижения и связи остаются бесплатными.", roadmapProduceDescription: "Мы помогаем производителям и поставщикам услуг сделать заметными себя, свои продукты и компетенции.", roadmapPromoteDescription: "Мы делимся презентациями производителей и запросами покупателей на основе надёжной информации, помогая нужным людям найти друг друга.", roadmapSellDescription: "Мы соединяем покупателей, производителей и логистических партнёров для прозрачных и реалистичных деловых связей.",
     ecosystem: "ЭКОСИСТЕМА", contactTitle: "Готовы к", contactTitleEmphasis: "глобальному росту?", contactDescription: "Мы создаём бесплатную B2B-сеть для производителей, покупателей и поставщиков услуг. Давайте расти вместе.", whatsapp: "НАПИСАТЬ В WHATSAPP", pageShare: "ПОДЕЛИТЬСЯ СТРАНИЦЕЙ", officialChannels: "ОФИЦИАЛЬНЫЕ КАНАЛЫ", officialChannelsDescription: "Ниже указаны наши проверяемые официальные профили в Instagram и TikTok.", officialChannelsPending: "Прямые ссылки на каналы Facebook, LinkedIn и операционную группу Telegram ещё готовятся.", quickLinks: "БЫСТРЫЕ ССЫЛКИ", about: "О нас", contactPage: "Контакты", investments: "Наши инвестиции", career: "Карьера", legalAndPayment: "ПРАВО И ОПЛАТА", serviceTerms: "Условия услуг", refund: "Возврат и отмена", delivery: "Условия доставки", distanceSales: "Дистанционная продажа", ecosystemTitle: "ЭКОСИСТЕМА", logistics: "Логистика", healthTourism: "Медицинский туризм", construction: "Строительство и развитие", financeMedia: "Финансы и медиа", footerDescription: "Мы соединяем производителей, покупателей, логистические и сервисные компании через бесплатную B2B-сеть.", contact: "КОНТАКТЫ", contactPending: "Официальная бизнес-линия готовится.", privacy: "Политика конфиденциальности", cookies: "Политика cookie", kvkk: "KVKK", floatingAction: "Быстрые действия",
  },
};

export default function Home() {
  const { locale } = useI18n();
  const copy = homeCopy[locale];
  const staff = staffLabels[locale];
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `MMT Global | ${copy.heroDescriptionStrong}`;
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const encodedShareText = encodeURIComponent(shareText);

  return (
    <div className="relative w-full min-h-[100dvh] bg-background text-foreground selection:bg-primary selection:text-white overflow-x-hidden">
      {/* Navigation */}
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out px-6 md:px-12 py-6",
          isScrolled || mobileMenuOpen ? "bg-background/90 backdrop-blur-md border-b border-border/50" : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2 z-50">
            <div className="w-8 h-8 bg-primary rounded-br-xl rounded-tl-xl flex items-center justify-center text-primary-foreground font-bold text-lg tracking-tighter group-hover:scale-95 transition-transform">
              M
            </div>
            <span className="font-semibold text-lg tracking-wider">
              MMT <span className="font-light opacity-80">GLOBAL</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium tracking-wide">
            <button onClick={() => scrollToSection("approach")} className="hover:text-primary transition-colors">
              {copy.navApproach}
            </button>
            <button onClick={() => scrollToSection("ecosystem")} className="hover:text-primary transition-colors">
              {copy.navEcosystem}
            </button>
            <Link href="/birimler" className="hover:text-primary transition-colors">
              {copy.navDepartments}
            </Link>
            <button onClick={() => scrollToSection("corporate-fleet")} className="hover:text-primary transition-colors">
              {copy.navFleet}
            </button>
            <button onClick={() => scrollToSection("contact")} className="hover:text-primary transition-colors">
              {copy.navContact}
            </button>
            <Link href="/b2b-agi" className="hover:text-primary transition-colors">
              {copy.navB2B}
            </Link>
              <Link
                href="/limit"
                onClick={() =>
                  trackEvent("application_center_opened", {
                    location: "desktop_navigation",
                  })
                }
                className="px-5 py-2.5 bg-primary text-white hover:bg-primary/90 transition-colors rounded-none font-semibold uppercase tracking-wider text-xs"
              >
                {copy.portal}
              </Link>
              <Link
                href="/cuzdan-demo"
                className="border border-primary px-5 py-2.5 text-primary transition-colors hover:bg-primary hover:text-white rounded-none font-semibold uppercase tracking-wider text-xs"
              >
                {copy.wallet}
              </Link>
                <Link
                href="/odeme"
                className="border border-foreground/30 px-5 py-2.5 text-foreground transition-colors hover:border-primary hover:text-primary rounded-none font-semibold uppercase tracking-wider text-xs"
              >
                  {copy.payment}
              </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="relative z-[60] flex min-h-12 min-w-12 items-center justify-center p-2 -mr-2 touch-manipulation"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        id="mobile-navigation"
        className={cn(
          "fixed inset-0 overflow-y-auto bg-background/95 backdrop-blur-xl z-40 flex flex-col items-center justify-start gap-7 px-6 py-24 transition-all duration-300 ease-in-out md:hidden",
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="grid w-full max-w-sm grid-cols-3 gap-2 border-b border-border/70 pb-6">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="border border-primary/50 bg-primary/10 px-2 py-3 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-primary"
          >
            {copy.home}
          </Link>
          <Link
            href="/b2b-agi"
            onClick={() => setMobileMenuOpen(false)}
            className="border border-border px-2 py-3 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/75"
          >
            {copy.navB2B}
          </Link>
          <Link
            href="/b2b-agi/panel"
            onClick={() => setMobileMenuOpen(false)}
            className="border border-border px-2 py-3 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/75"
          >
            {copy.companyPanel}
          </Link>
        </div>
        <Link
          href="/staff/giris"
          onClick={() => setMobileMenuOpen(false)}
          className="w-full max-w-sm border border-primary bg-primary/10 px-5 py-4 text-center text-sm font-bold uppercase tracking-[0.12em] text-primary"
        >
          {staff.login}
        </Link>
        <button onClick={() => scrollToSection("approach")} className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          {copy.navApproach}
        </button>
        <button onClick={() => scrollToSection("ecosystem")} className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          {copy.navEcosystem}
        </button>
        <Link href="/birimler" className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          {copy.navDepartments}
        </Link>
        <button onClick={() => scrollToSection("corporate-fleet")} className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          {copy.navFleet}
        </button>
        <button onClick={() => scrollToSection("contact")} className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          {copy.navContact}
        </button>
        <Link href="/b2b-agi" className="text-2xl font-semibold tracking-wide hover:text-primary transition-colors">
          {copy.navB2B}
        </Link>
        <div className="mt-4 grid w-[min(20rem,calc(100vw-3rem))] grid-cols-2 gap-3 border-t border-border/60 pt-6">
          <p className="col-span-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-foreground/50">
            {copy.categories}
          </p>
          <Link href="/limit/ticari" className="border border-border px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider hover:border-primary hover:text-primary">
            {copy.categoryCommercial}
          </Link>
          <Link href="/limit/konut" className="border border-border px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider hover:border-primary hover:text-primary">
            {copy.categoryHousing}
          </Link>
          <Link href="/limit/tasit" className="border border-border px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider hover:border-primary hover:text-primary">
            {copy.categoryVehicle}
          </Link>
          <Link href="/limit/bireysel" className="border border-border px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider hover:border-primary hover:text-primary">
            {copy.categoryIndividual}
          </Link>
        </div>
        <Link
          href="/limit"
          onClick={() =>
            trackEvent("application_center_opened", {
              location: "mobile_navigation",
            })
          }
          className="mt-2 px-8 py-4 bg-primary text-white transition-colors rounded-none font-semibold uppercase tracking-wider text-sm"
        >
          {copy.allApplications}
        </Link>
        <Link
          href="/cuzdan-demo"
          className="mt-2 border border-primary px-8 py-4 text-primary transition-colors hover:bg-primary hover:text-white rounded-none font-semibold uppercase tracking-wider text-sm"
        >
          {copy.wallet}
        </Link>
        <Link
          href="/odeme"
          className="mt-2 border border-foreground/30 px-8 py-4 text-foreground transition-colors hover:border-primary hover:text-primary rounded-none font-semibold uppercase tracking-wider text-sm"
        >
          {copy.payment}
        </Link>
      </div>

      {/* Hero Section */}
      <section className="relative min-h-[calc(100dvh-1rem)] w-full flex flex-col justify-center overflow-hidden pb-10 pt-24 md:min-h-[100dvh] md:pb-12">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50"
            style={{ backgroundImage: `url(${HERO_BG})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 md:gap-16 md:px-12">
          
          {/* Top Label */}
          <div className="flex items-center gap-4 md:opacity-0 md:animate-slide-up-fade delay-150">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <p className="text-xs md:text-sm tracking-[0.2em] font-medium text-foreground/80 uppercase">
              {copy.heroKicker}
            </p>
          </div>

          {/* Headline */}
          <h1 className="flex flex-col gap-1 text-[4.25rem] leading-[0.85] tracking-tight sm:text-[5.5rem] md:gap-2 md:text-[8rem] lg:text-[10rem]">
            <span className="font-semibold md:opacity-0 md:animate-slide-up-fade delay-300">
              {copy.produce}
            </span>
            <span className="font-serif italic text-primary font-normal md:opacity-0 md:animate-slide-up-fade delay-500">
              {copy.promote}
            </span>
            <span className="font-semibold md:opacity-0 md:animate-slide-up-fade delay-700">
              {copy.sell}
            </span>
          </h1>

          {/* Subtext and CTA row */}
          <div className="mt-4 flex flex-col justify-between gap-6 md:mt-16 md:flex-row md:items-end md:gap-12">
            <div className="max-w-xl md:opacity-0 md:animate-slide-up-fade delay-1000">
              <p className="text-base leading-relaxed text-foreground/80 md:text-xl">
                <strong className="font-semibold text-foreground">{copy.heroDescriptionStrong}</strong><br/>
                 {copy.heroDescription}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
                <Link
                  href="/b2b-agi/katil"
                  className="inline-flex w-fit items-center justify-center gap-2 bg-primary px-5 py-3 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {copy.registerCompany}
                  <ArrowRight size={15} />
                </Link>
                <Link
                  href="/b2b-agi"
                  className="inline-flex w-fit items-center justify-center gap-2 border border-primary px-5 py-3 text-xs font-semibold uppercase tracking-wider text-primary transition-colors hover:bg-primary hover:text-white"
                >
                  {copy.joinNetwork}
                  <ArrowRight size={15} />
                </Link>
                <Link
                  href="/b2b-agi/panel"
                  className="inline-flex w-fit items-center justify-center gap-2 border border-foreground/35 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {copy.inviteTeam}
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>
            
            <button 
              onClick={() => scrollToSection("approach")}
              className="group flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-full border border-primary/40 flex items-center justify-center hover:bg-primary hover:border-primary transition-all duration-500 opacity-0 animate-slide-up-fade delay-1000"
                aria-label={copy.discover}
            >
              <ArrowDownRight className="w-8 h-8 text-primary group-hover:text-white transition-colors duration-500 group-hover:translate-x-1 group-hover:translate-y-1" />
            </button>
          </div>

          {/* Scroll Cue */}
          <div className="absolute bottom-8 left-6 hidden items-center gap-6 opacity-0 animate-slide-up-fade delay-1000 md:left-12 md:flex">
            <span className="text-[10px] md:text-xs tracking-[0.3em] text-foreground/60 font-medium">{copy.discover}</span>
            <div className="w-16 md:w-24 h-[1px] bg-foreground/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-primary w-full origin-left animate-[scale-x_2s_ease-in-out_infinite]" />
            </div>
          </div>

        </div>
      </section>

      {/* Approach Section */}
      <section id="approach" className="bg-secondary text-secondary-foreground py-24 md:py-32 px-6 md:px-12 rounded-t-3xl md:rounded-t-[3rem] -mt-6 relative z-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-6 mb-16 md:mb-24">
            <span className="text-primary font-mono text-sm tracking-widest">01</span>
            <h2 className="text-xs tracking-[0.2em] uppercase font-bold text-secondary-foreground/60">{copy.approach}</h2>
            <div className="flex-1 h-[1px] bg-border/40" />
            <div className="w-12 h-12 bg-background flex items-center justify-center rounded-tl-xl rounded-br-xl text-primary">
              <Globe2 size={20} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24">
            <div className="flex flex-col justify-center">
              <h3 className="text-4xl md:text-5xl lg:text-6xl font-serif italic mb-8 leading-tight">
                 {copy.approachTitle}
              </h3>
              <p className="text-lg text-secondary-foreground/70 leading-relaxed font-light mb-8">
                 {copy.approachDescription}
              </p>
               <button onClick={() => scrollToSection("ecosystem")} className="flex items-center gap-3 text-sm font-semibold tracking-wider uppercase w-fit group">
                 <span className="border-b border-primary pb-1 group-hover:text-primary transition-colors">{copy.discoverStory}</span>
                <ArrowRight size={16} className="text-primary group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
            <div className="relative aspect-[4/5] md:aspect-square bg-muted rounded-bl-[4rem] rounded-tr-[4rem] overflow-hidden">
               {/* Decorative architectural/abstract placeholder for approach */}
               <div className="absolute inset-0 bg-gradient-to-tr from-background/40 to-transparent z-10" />
               <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
            </div>
          </div>

          <div className="mt-20 border-t border-border/40 pt-12 md:mt-28 md:pt-16">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-xs tracking-[0.2em] text-primary">{copy.roadmap}</p>
                <h3 className="mt-3 text-3xl font-semibold md:text-4xl">{copy.roadmapTitle}</h3>
              </div>
              <p className="max-w-xl text-sm leading-7 text-secondary-foreground/65">
                 {copy.roadmapDescription}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <RoadmapStep
                number="01"
                 title={copy.produce}
                text={copy.roadmapProduceDescription}
              />
              <RoadmapStep
                number="02"
                 title={copy.promote}
                text={copy.roadmapPromoteDescription}
              />
              <RoadmapStep
                number="03"
                 title={copy.sell}
                text={copy.roadmapSellDescription}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Ecosystem Section */}
      <section id="ecosystem" className="py-24 md:py-32 px-6 md:px-12 bg-background relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-6 mb-16 md:mb-24">
            <span className="text-primary font-mono text-sm tracking-widest">02</span>
            <h2 className="text-xs tracking-[0.2em] uppercase font-bold text-foreground/60">{copy.ecosystem}</h2>
            <div className="flex-1 h-[1px] bg-border/40" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 md:gap-y-16">
            
            <EcosystemCard 
              icon={<Truck className="w-8 h-8" />}
               title={copy.logistics}
               desc={copy.heroDescription}
               href="/birimler/lojistik"
            />
            <EcosystemCard 
              icon={<Stethoscope className="w-8 h-8" />}
               title={copy.healthTourism}
               desc={copy.approachDescription}
            />
            <EcosystemCard 
              icon={<Building2 className="w-8 h-8" />}
               title={copy.construction}
               desc={copy.approachDescription}
                href="/birimler"
            />
            <EcosystemCard 
              icon={<Tv className="w-8 h-8" />}
               title={copy.financeMedia}
               desc={copy.officialChannelsDescription}
               href="/birimler"
            />
            <EcosystemCard 
              icon={<Briefcase className="w-8 h-8" />}
               title={copy.payment}
               desc={copy.heroDescription}
              href="/limit"
              analyticsLocation="ecosystem_card"
            />
            <EcosystemCard 
              icon={<Factory className="w-8 h-8" />}
               title={copy.ecosystemTitle}
               desc={copy.roadmapDescription}
            />

          </div>
        </div>
      </section>

      {/* Corporate Fleet Section */}
      <CorporateFleetSection onContact={() => scrollToSection("contact")} />

      {/* CTA / Contact Section */}
      <section id="contact" className="relative py-24 md:py-32 px-6 md:px-12 bg-primary text-primary-foreground overflow-hidden">
        {/* Abstract background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center flex flex-col items-center">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-semibold mb-8 tracking-tight leading-tight">
            {copy.contactTitle} <br/> <span className="font-serif italic font-normal">{copy.contactTitleEmphasis}</span>
          </h2>
          <p className="text-lg md:text-xl opacity-90 max-w-2xl mb-12 font-light">
            {copy.contactDescription}
          </p>
           <div className="flex flex-col sm:flex-row gap-6">
               {BUSINESS_CONTACTS_READY ? (
                 <a href="#" target="_blank" rel="noreferrer" className="px-8 py-4 bg-background text-foreground hover:bg-background/90 transition-colors font-semibold uppercase tracking-wider text-sm">
                  {copy.whatsapp}
                 </a>
               ) : (
                 <div className="px-8 py-4 border border-primary-foreground/60 font-semibold uppercase tracking-wider text-sm">
                  {copy.contactPending}
                 </div>
               )}
               <Link href="/odeme" className="px-8 py-4 bg-transparent border border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary transition-colors font-semibold uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                 {copy.payment}
               </Link>
          </div>
           <div className="mt-12 flex flex-col items-center gap-4">
             <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
               <Share2 size={15} />
                <span>{copy.pageShare}</span>
             </div>
             <div className="flex flex-wrap justify-center gap-2">
               <a
                 href={`https://wa.me/?text=${encodedShareText}%20${encodedShareUrl}`}
                 target="_blank"
                 rel="noreferrer"
                 className="border border-primary-foreground/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-primary-foreground hover:text-primary"
               >
                 WhatsApp
               </a>
               <a
                 href={`https://t.me/share/url?url=${encodedShareUrl}&text=${encodedShareText}`}
                 target="_blank"
                 rel="noreferrer"
                 className="border border-primary-foreground/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-primary-foreground hover:text-primary"
               >
                 Telegram
               </a>
               <a
                 href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`}
                 target="_blank"
                 rel="noreferrer"
                 className="border border-primary-foreground/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-primary-foreground hover:text-primary"
               >
                 Facebook
               </a>
               <a
                 href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedShareUrl}`}
                 target="_blank"
                 rel="noreferrer"
                 className="border border-primary-foreground/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-primary-foreground hover:text-primary"
               >
                 LinkedIn
               </a>
             </div>
               <div className="mt-3 w-full max-w-xl border border-primary-foreground/70 bg-background/10 px-5 py-5 text-left">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-br-xl rounded-tl-xl bg-background text-xl font-bold text-primary">
                  M
                </div>
                 <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]">{copy.officialChannels}</p>
                  <p className="mt-2 text-sm leading-relaxed opacity-80">{copy.officialChannelsDescription}</p>
                   <div className="mt-4 grid gap-3 sm:grid-cols-2">
                     {OFFICIAL_SOCIAL_CHANNELS.map(({ platform, handle, href, icon: Icon }) => (
                       <a
                         key={platform}
                         href={href}
                         target="_blank"
                         rel="noreferrer"
                         aria-label={`${platform} ${handle}`}
                         className="group flex items-center gap-3 border border-primary-foreground/40 px-3 py-3 transition-colors hover:bg-primary-foreground hover:text-primary"
                       >
                         <Icon size={18} />
                         <span className="min-w-0">
                           <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">{platform}</span>
                           <span className="block truncate text-sm font-semibold">{handle}</span>
                         </span>
                         <ArrowRight size={15} className="ml-auto shrink-0 transition-transform group-hover:translate-x-1" />
                       </a>
                     ))}
                   </div>
                   <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">{copy.officialChannelsPending}</p>
                </div>
              </div>
           </div>
        </div>
      </section>

      {/* Footer */}
       <footer className="bg-background border-t border-border pt-16 pb-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
           <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-16">
            <div className="md:col-span-1">
               <Link href="/" className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 bg-primary rounded-br-lg rounded-tl-lg flex items-center justify-center text-primary-foreground font-bold text-xs">
                  M
                </div>
                <span className="font-semibold tracking-wider text-sm">
                  MMT <span className="font-light opacity-80">GLOBAL</span>
                </span>
              </Link>
               <p className="text-sm text-foreground/60 font-light leading-relaxed">
                  {copy.footerDescription}
               </p>
               <div className="mt-6 flex flex-col gap-3 text-sm">
                 <Link href="/staff/giris" className="text-primary hover:underline">{staff.login}</Link>
                 <Link href="/staff/medya-merkezi" className="text-foreground/60 hover:text-primary">{staff.media}</Link>
               </div>
            </div>
            
            <div>
               <h4 className="font-semibold text-sm mb-6 uppercase tracking-wider">{copy.quickLinks}</h4>
              <ul className="space-y-4 text-sm text-foreground/60">
                  <li><Link href="/hakkimizda" className="hover:text-primary transition-colors">{copy.about}</Link></li>
                  <li><Link href="/iletisim" className="hover:text-primary transition-colors">{copy.contactPage}</Link></li>
                  <li><Link href="/birimler" className="hover:text-primary transition-colors">{copy.navDepartments}</Link></li>
                 <li><button onClick={() => scrollToSection("approach")} className="hover:text-primary transition-colors">{copy.navApproach}</button></li>
                 <li><button onClick={() => scrollToSection("ecosystem")} className="hover:text-primary transition-colors">{copy.navEcosystem}</button></li>
                 <li><Link href="/yatirimlar" className="hover:text-primary transition-colors">{copy.investments}</Link></li>
                 <li><Link href="/kariyer" className="hover:text-primary transition-colors">{copy.career}</Link></li>
                 <li><Link href="/odeme" className="hover:text-primary transition-colors">{copy.payment}</Link></li>
              </ul>
            </div>

            <div>
               <h4 className="font-semibold text-sm mb-6 uppercase tracking-wider">{copy.ecosystemTitle}</h4>
              <ul className="space-y-4 text-sm text-foreground/60">
                  <li><Link href="/birimler/lojistik" className="hover:text-primary transition-colors">{copy.logistics}</Link></li>
                 <li><span className="hover:text-primary transition-colors cursor-pointer">{copy.healthTourism}</span></li>
                 <li><Link href="/birimler" className="hover:text-primary transition-colors" data-testid="link-footer-construction">{copy.construction}</Link></li>
                <li>
                   <Link href="/birimler" className="hover:text-primary transition-colors">
                     {copy.financeMedia}
                  </Link>
                </li>
              </ul>
            </div>

             <div>
               <h4 className="font-semibold text-sm mb-6 uppercase tracking-wider">{copy.contact}</h4>
              <ul className="space-y-4 text-sm text-foreground/60">
                  <li><Link href="/iletisim" className="hover:text-primary transition-colors">{copy.contactPage}</Link></li>
                  <li>{copy.contactPending}</li>
               </ul>
             </div>

             <div>
               <h4 className="font-semibold text-sm mb-6 uppercase tracking-wider">{copy.legalAndPayment}</h4>
               <ul className="space-y-4 text-sm text-foreground/60">
                  <li><Link href="/hizmet-kosullari" className="hover:text-primary transition-colors">{copy.serviceTerms}</Link></li>
                  <li><Link href="/mesafeli-satis" className="hover:text-primary transition-colors">{copy.distanceSales}</Link></li>
                  <li><Link href="/teslimat" className="hover:text-primary transition-colors">{copy.delivery}</Link></li>
                  <li><Link href="/iade" className="hover:text-primary transition-colors">{copy.refund}</Link></li>
                  <li><Link href="/gizlilik" className="hover:text-primary transition-colors">{copy.privacy}</Link></li>
                  <li><Link href="/kvkk" className="hover:text-primary transition-colors">{copy.kvkk}</Link></li>
                  <li><Link href="/cerez" className="hover:text-primary transition-colors">{copy.cookies}</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-foreground/40 font-light">
             <p>© {new Date().getFullYear()} MMT Global. MMT Global</p>
            <div className="flex gap-6">
               <Link href="/gizlilik" className="hover:text-foreground transition-colors">{copy.privacy}</Link>
               <Link href="/cerez" className="hover:text-foreground transition-colors">{copy.cookies}</Link>
               <Link href="/kvkk" className="hover:text-foreground transition-colors">{copy.kvkk}</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Global CSS animation for the scroll line */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scale-x {
          0% { transform: scaleX(0); transform-origin: left; }
          50% { transform: scaleX(1); transform-origin: left; }
          50.1% { transform: scaleX(1); transform-origin: right; }
          100% { transform: scaleX(0); transform-origin: right; }
        }
      `}} />

      {/* Floating Action Button */}
       <button onClick={() => scrollToSection("contact")} className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 w-12 h-12 md:w-14 md:h-14 bg-card rounded-full shadow-lg shadow-black/20 flex flex-col items-center justify-center gap-0.5 border border-border group hover:scale-105 transition-transform" aria-label={copy.floatingAction}>
        <div className="flex gap-0.5">
          <div className="w-1.5 h-1.5 bg-primary rounded-full group-hover:bg-primary/80" />
          <div className="w-1.5 h-1.5 bg-primary rounded-full group-hover:bg-primary/80" />
        </div>
        <div className="flex gap-0.5">
          <div className="w-1.5 h-1.5 bg-primary rounded-full group-hover:bg-primary/80" />
          <div className="w-1.5 h-1.5 bg-primary rounded-full group-hover:bg-primary/80" />
        </div>
      </button>
    </div>
  );
}

function RoadmapStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <article className="border border-border/50 bg-background/40 p-6 md:p-7">
      <p className="font-mono text-xs tracking-[0.2em] text-primary">{number}</p>
      <h4 className="mt-5 text-2xl font-semibold">{title}</h4>
      <p className="mt-4 text-sm leading-7 text-secondary-foreground/65">{text}</p>
    </article>
  );
}

function EcosystemCard({
  icon,
  title,
  desc,
  href,
  analyticsLocation,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href?: string;
  analyticsLocation?: string;
}) {
  const card = (
    <div className="group border border-border/50 bg-card p-8 md:p-10 hover:border-primary/50 transition-all duration-500 rounded-tr-[2rem] rounded-bl-[2rem] hover:-translate-y-2 flex flex-col">
      <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center text-primary mb-8 group-hover:scale-110 transition-transform duration-500 shadow-sm border border-border/50">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-4 text-card-foreground group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-card-foreground/70 font-light leading-relaxed text-sm mb-8 flex-grow">
        {desc}
      </p>
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-primary transition-all duration-300 group-hover:translate-x-1">
        <span>{href ? "Başvuruyu başlat" : "İncele"}</span>
        <ArrowRight size={14} />
      </div>
    </div>
  );

  return href ? (
    <Link
      href={href}
      onClick={() =>
        analyticsLocation &&
        trackEvent("application_center_opened", {
          location: analyticsLocation,
        })
      }
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {card}
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => {
        document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
      }}
      className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`${title} hakkında iletişime geç`}
    >
      {card}
    </button>
  );
}
