import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, Globe2, Megaphone, Menu, X } from "lucide-react";
import { useI18n, type Locale } from "@/lib/i18n";
import "@/styles/mmt-corporate.css";

type Copy = {
  brand: string;
  nav: [string, string, string, string, string];
  entry: string;
  kicker: string;
  title: string;
  lead: string;
  fieldsCta: string;
  joinCta: string;
  statusTitle: string;
  statusIntro: string;
  sections: Array<{ kicker: string; title: string; description: string }>;
  fields: Array<{ title: string; text: string; status: string; ready: boolean; href?: string; link?: string }>;
  regions: Array<{ title: string; text: string }>;
  steps: string[];
  mediaEmpty: string;
  mediaStatus: string;
  contactTitle: string;
  contactText: string;
  contactCta: string;
  footer: string;
  languages: string;
  menuOpen: string;
  menuClose: string;
};

const copy: Record<Locale, Copy> = {
  tr: {
    brand: "MMT GLOBAL / KURUMSAL YAPI",
    nav: ["Kurumsal", "Faaliyet alanları", "Uluslararası ağ", "İş ortaklığı", "İletişim"],
    entry: "Çalışma alanına giriş",
    kicker: "MMT GLOBAL / KURUMSAL YAPI",
    title: "Uzmanlığı, ticareti ve operasyonu bir araya getiriyoruz.",
    lead: "MMT Global; farklı alanlardaki uzmanları, işletmeleri ve iş ortaklarını ortak çalışma ve takip sistemiyle buluşturmak için gelişiyor.",
    fieldsCta: "Faaliyet alanlarımız",
    joinCta: "İş birliği başvurusu",
    statusTitle: "Açık durum",
    statusIntro: "Bu yapı gelişim aşamasındadır. Dijital araçların varlığı, bir hizmetin her bölgede operasyonel olarak sunulduğu anlamına gelmez; her alanın kapsamı ayrıca belirtilir.",
    sections: [
      { kicker: "01 / Faaliyet alanları", title: "Birden çok alan, tek çalışma disiplini", description: "Hazırlık aşamasındaki alanlar faal hizmet gibi sunulmaz. Durum etiketleri dijital araçları ve hazırlık alanlarını birbirinden ayırır." },
      { kicker: "02 / Uluslararası ağ", title: "Bölgesel çalışma kartları", description: "Kartlar çalışma ve araştırma odağını gösterir; doğrulanmamış ofis, şirket veya yerleşke iddiası içermez." },
      { kicker: "03 / Çalışma biçimimiz", title: "Talebin izini kaybetmeden ilerleriz", description: "Her iş dosyası; sorumlusu, durumu, tarihi ve sonraki adımı görünür kılacak şekilde ele alınır." },
      { kicker: "04 / Pilot günlüğü ve medya", title: "Sadece hazırlığı ve onayı tamamlananı paylaşırız", description: "Dijital araçlar üretim akışında mevcuttur; bu sayfada canlı içerik veya doğrulanmış pilot kaydı gösterilmez." },
    ],
    fields: [
      { title: "Lojistik ve Taşımacılık", text: "Lojistik merkezi ve dijital iş takibi araçları mevcuttur; taşımacılık hizmet kapsamı ve operasyon durumu ayrıca doğrulanmalıdır.", status: "Dijital araç", ready: true, href: "/lojistik", link: "Lojistik merkezini görüntüle" },
      { title: "Uluslararası Ticaret ve B2B", text: "Üretici, alıcı ve iş ortakları için dijital B2B ağı mevcuttur. Her ilan ve bağlantı kendi inceleme sürecine tabidir.", status: "Dijital araç", ready: true, href: "/b2b-agi", link: "B2B ağını görüntüle" },
      { title: "Finansman Danışmanlığı", text: "İşletmeler için seçenek ve yönlendirme çalışması; doğrulanmış bir danışmanlık hizmeti olarak sunulmamaktadır.", status: "Hazırlık", ready: false },
      { title: "Sağlık Turizmi", text: "Sınır ötesi sağlık hizmetleri için olası uzmanlık ve iş birliği zemini; hizmet faaliyeti doğrulanmamıştır.", status: "Hazırlık", ready: false },
      { title: "İnşaat ve Gelişim", text: "Mezopotamya Build ürün kataloğu, sepet ve proje teklifi araçları açıktır. Ürünler Shopify'da yayımlandıkça görünür; çevrimiçi ödeme satıcı doğrulaması bekliyor.", status: "Katalog ve teklif", ready: true, href: "/insaat-magaza", link: "İnşaat mağazasını görüntüle" },
      { title: "Medya ve Tanıtım", text: "Kurumsal içerik ve medya araçları mevcuttur; onaylanmış bir duyuru veya yayınlanabilir pilot kaydı bulunmuyor.", status: "Dijital araç", ready: true, href: "/staff/yonlendir", link: "Çalışma alanı girişi" },
    ],
    regions: [
      { title: "Türkiye", text: "Merkezden yürütülen çalışma ve iş ortağı koordinasyonu için ana bölge." },
      { title: "Ukrayna", text: "Uluslararası ağ kapsamında değerlendirilen bölgesel çalışma odağı." },
      { title: "Dubai / BAE", text: "Ticaret ve lojistik bağlantıları için hazırlık kapsamında incelenen bölge." },
      { title: "Irak", text: "Bölgesel ticaret ve operasyon ihtiyaçları için değerlendirme odağı." },
    ],
    steps: ["Talep", "Uzman değerlendirmesi", "Planlama", "Gerekli onay", "Uygulama ve raporlama"],
    mediaEmpty: "Onaylanmış duyuru veya yayınlanabilir pilot kaydı bulunmuyor.",
    mediaStatus: "Durum: TASLAK / HAZIRLIK · Sorumlu, tarih ve sonraki adım canlı çalışma alanında tutulur.",
    contactTitle: "Bir çalışma alanına katkı sunmak ister misiniz?",
    contactText: "Uzmanlık alanınızı, şirketinizi veya bölgesel bağlantınızı doğrulanabilir bilgilerle paylaşın. Uygunluk ve rol değerlendirmesi çalışma dosyası üzerinden yapılır.",
    contactCta: "İletişime geçin",
    footer: "© MMT Global · Kurumsal",
    languages: "Dil",
    menuOpen: "Menüyü aç",
    menuClose: "Menüyü kapat",
  },
  en: {
    brand: "MMT GLOBAL / CORPORATE",
    nav: ["Corporate", "Areas of work", "International network", "Partnership", "Contact"],
    entry: "Enter workspace",
    kicker: "MMT GLOBAL / CORPORATE",
    title: "Bringing expertise, trade and operations together.",
    lead: "MMT Global is developing a shared way for specialists, businesses and partners across different fields to work together and follow progress.",
    fieldsCta: "Our areas of work",
    joinCta: "Partner with us",
    statusTitle: "Status, clearly stated",
    statusIntro: "This organization is in development. The availability of digital tools does not mean that a service operates in every region; the scope of each area is stated separately.",
    sections: [
      { kicker: "01 / Areas of work", title: "Multiple fields, one way of working", description: "Areas in preparation are not presented as active services. Status labels distinguish digital tools from areas still in preparation." },
      { kicker: "02 / International network", title: "Regional focus cards", description: "These cards describe areas of focus and research; they do not claim unverified offices, companies or facilities." },
      { kicker: "03 / How we work", title: "Every request has a traceable next step", description: "Each work file is handled so that its owner, status, date and next step are visible." },
      { kicker: "04 / Pilot log and media", title: "We share only what is ready and approved", description: "Digital tools are available in the workflow; this page does not show live content or a verified pilot record." },
    ],
    fields: [
      { title: "Logistics and Transport", text: "A logistics hub and digital work-tracking tools are available; transport service scope and operational status require separate verification.", status: "Digital tools", ready: true, href: "/lojistik", link: "View logistics hub" },
      { title: "International Trade and B2B", text: "A digital B2B network for producers, buyers and partners is available. Listings and connections are subject to their own review.", status: "Digital tools", ready: true, href: "/b2b-agi", link: "View B2B network" },
      { title: "Finance Advisory", text: "Options and referral work for businesses; this is not presented as a verified advisory service.", status: "In preparation", ready: false },
      { title: "Health Tourism", text: "A potential basis for expertise and cross-border healthcare partnerships; service operations are not verified.", status: "In preparation", ready: false },
      { title: "Construction and Development", text: "Mezopotamya Build catalog, cart, and project quote tools are open. Products appear when published in Shopify; online payment awaits merchant verification.", status: "Catalog and quotes", ready: true, href: "/insaat-magaza", link: "View construction store" },
      { title: "Media and Promotion", text: "Corporate content and media tools are available; there is no approved announcement or publishable pilot record.", status: "Digital tools", ready: true, href: "/staff/yonlendir", link: "Enter workspace" },
    ],
    regions: [
      { title: "Türkiye", text: "Primary region for centrally coordinated work and partner coordination." },
      { title: "Ukraine", text: "A regional focus being assessed as part of the international network." },
      { title: "Dubai / UAE", text: "Being explored in preparation for trade and logistics connections." },
      { title: "Iraq", text: "A focus for assessing regional trade and operational needs." },
    ],
    steps: ["Request", "Expert review", "Planning", "Required approval", "Delivery and reporting"],
    mediaEmpty: "There are no approved announcements or publishable pilot records.",
    mediaStatus: "Status: DRAFT / PREPARATION · Owner, date and next step are tracked in the live workspace.",
    contactTitle: "Would you like to contribute to an area of work?",
    contactText: "Share verifiable information about your expertise, company or regional connections. Suitability and role are assessed through a work file.",
    contactCta: "Contact us",
    footer: "© MMT Global · Corporate",
    languages: "Language",
    menuOpen: "Open menu",
    menuClose: "Close menu",
  },
  ar: {
    brand: "MMT GLOBAL / نبذة مؤسسية",
    nav: ["الشركة", "مجالات العمل", "الشبكة الدولية", "الشراكة", "اتصل بنا"],
    entry: "دخول مساحة العمل",
    kicker: "MMT GLOBAL / نبذة مؤسسية",
    title: "نجمع الخبرة والتجارة والعمليات معاً.",
    lead: "تعمل MMT Global على تطوير أسلوب عمل ومتابعة مشترك يجمع المتخصصين والشركات والشركاء في مجالات متعددة.",
    fieldsCta: "مجالات عملنا",
    joinCta: "تعاون معنا",
    statusTitle: "الحالة بوضوح",
    statusIntro: "هذا الهيكل في مرحلة التطوير. وجود الأدوات الرقمية لا يعني تشغيل الخدمة في كل منطقة؛ ويُوضح نطاق كل مجال على حدة.",
    sections: [
      { kicker: "01 / مجالات العمل", title: "مجالات متعددة ومنهج عمل واحد", description: "لا تُعرض المجالات قيد الإعداد كخدمات قائمة. وتفصل تسميات الحالة بين الأدوات الرقمية ومجالات الإعداد." },
      { kicker: "02 / الشبكة الدولية", title: "بطاقات التركيز الإقليمي", description: "توضح البطاقات مجالات التركيز والبحث ولا تدّعي وجود مكاتب أو شركات أو مرافق غير مؤكدة." },
      { kicker: "03 / أسلوب العمل", title: "لكل طلب خطوة تالية قابلة للمتابعة", description: "يُدار كل ملف عمل بحيث يكون المسؤول والحالة والتاريخ والخطوة التالية واضحة." },
      { kicker: "04 / سجل التجارب والإعلام", title: "ننشر ما اكتمل واعتمد فقط", description: "الأدوات الرقمية متاحة ضمن سير العمل؛ ولا تعرض هذه الصفحة محتوى مباشراً أو سجلاً مؤكداً لتجربة." },
    ],
    fields: [
      { title: "الخدمات اللوجستية والنقل", text: "يتوفر مركز لوجستي وأدوات رقمية لمتابعة العمل؛ ويجب التحقق بشكل منفصل من نطاق النقل وحالته التشغيلية.", status: "أدوات رقمية", ready: true, href: "/lojistik", link: "عرض مركز الخدمات اللوجستية" },
      { title: "التجارة الدولية وB2B", text: "تتوفر شبكة رقمية للمنتجين والمشترين والشركاء. وتخضع الإعلانات والاتصالات للمراجعة.", status: "أدوات رقمية", ready: true, href: "/b2b-agi", link: "عرض شبكة B2B" },
      { title: "استشارات التمويل", text: "عمل على الخيارات والإحالات للشركات؛ ولا يُعرض كخدمة استشارية مؤكدة.", status: "قيد الإعداد", ready: false },
      { title: "السياحة الصحية", text: "إطار محتمل للخبرات والشراكات الصحية العابرة للحدود؛ لم يتم تأكيد تشغيل الخدمات.", status: "قيد الإعداد", ready: false },
      { title: "الإنشاء والتطوير", text: "كتالوج Mezopotamya Build والسلة وطلبات عروض أسعار المشاريع متاحة. تظهر المنتجات عند نشرها في Shopify؛ الدفع الإلكتروني ينتظر التحقق من التاجر.", status: "الكتالوج وعروض الأسعار", ready: true, href: "/insaat-magaza", link: "عرض متجر مواد البناء" },
      { title: "الإعلام والترويج", text: "تتوفر أدوات للمحتوى المؤسسي والإعلام؛ ولا توجد إعلانات معتمدة أو سجلات تجارب قابلة للنشر.", status: "أدوات رقمية", ready: true, href: "/staff/yonlendir", link: "دخول مساحة العمل" },
    ],
    regions: [
      { title: "تركيا", text: "المنطقة الرئيسية للعمل المنسق مركزياً والتنسيق مع الشركاء." },
      { title: "أوكرانيا", text: "محور إقليمي قيد التقييم ضمن الشبكة الدولية." },
      { title: "دبي / الإمارات", text: "منطقة قيد الدراسة استعداداً لروابط التجارة والخدمات اللوجستية." },
      { title: "العراق", text: "محور لتقييم احتياجات التجارة والعمليات الإقليمية." },
    ],
    steps: ["الطلب", "تقييم المتخصص", "التخطيط", "الموافقة المطلوبة", "التنفيذ والتقرير"],
    mediaEmpty: "لا توجد إعلانات معتمدة أو سجلات تجارب قابلة للنشر.",
    mediaStatus: "الحالة: مسودة / إعداد · يُتابع المسؤول والتاريخ والخطوة التالية في مساحة العمل.",
    contactTitle: "هل ترغب في المساهمة في أحد مجالات العمل؟",
    contactText: "شارك معلومات قابلة للتحقق عن خبرتك أو شركتك أو علاقاتك الإقليمية. ويُقيّم الملاءمة والدور عبر ملف عمل.",
    contactCta: "تواصل معنا",
    footer: "© MMT Global · مؤسسي",
    languages: "اللغة",
    menuOpen: "فتح القائمة",
    menuClose: "إغلاق القائمة",
  },
  ru: {
    brand: "MMT GLOBAL / О КОМПАНИИ",
    nav: ["О компании", "Направления", "Международная сеть", "Партнёрство", "Контакты"],
    entry: "Войти в рабочее пространство",
    kicker: "MMT GLOBAL / О КОМПАНИИ",
    title: "Объединяем экспертизу, торговлю и операционную работу.",
    lead: "MMT Global развивает общую систему работы и отслеживания задач для специалистов, компаний и партнёров из разных сфер.",
    fieldsCta: "Наши направления",
    joinCta: "Стать партнёром",
    statusTitle: "Статус без оговорок",
    statusIntro: "Организация находится в стадии развития. Наличие цифровых инструментов не означает, что услуга работает в каждом регионе; объём каждого направления указан отдельно.",
    sections: [
      { kicker: "01 / Направления", title: "Разные сферы — общий подход к работе", description: "Направления на этапе подготовки не представлены как действующие услуги. Метки разделяют цифровые инструменты и подготовительные направления." },
      { kicker: "02 / Международная сеть", title: "Карточки регионального фокуса", description: "Карточки обозначают направления работы и исследования, но не заявляют о неподтверждённых офисах, компаниях или объектах." },
      { kicker: "03 / Как мы работаем", title: "У каждого запроса есть следующий шаг", description: "Рабочее дело ведётся так, чтобы были видны ответственный, статус, дата и следующий шаг." },
      { kicker: "04 / Пилоты и медиа", title: "Публикуем только готовое и согласованное", description: "Цифровые инструменты доступны в рабочем процессе; на этой странице нет текущего контента или подтверждённой записи о пилоте." },
    ],
    fields: [
      { title: "Логистика и транспорт", text: "Доступны логистический центр и цифровые инструменты отслеживания задач; объём транспортных услуг и операционный статус требуют отдельного подтверждения.", status: "Цифровые инструменты", ready: true, href: "/lojistik", link: "Открыть логистический центр" },
      { title: "Международная торговля и B2B", text: "Доступна цифровая B2B-сеть для производителей, покупателей и партнёров. Объявления и контакты проходят отдельную проверку.", status: "Цифровые инструменты", ready: true, href: "/b2b-agi", link: "Открыть B2B-сеть" },
      { title: "Финансовый консалтинг", text: "Подготовка вариантов и направлений для бизнеса; это не заявляется как подтверждённая консультационная услуга.", status: "Подготовка", ready: false },
      { title: "Медицинский туризм", text: "Возможная основа для экспертизы и международного сотрудничества в здравоохранении; работа услуг не подтверждена.", status: "Подготовка", ready: false },
      { title: "Строительство и развитие", text: "Каталог Mezopotamya Build, корзина и запросы расчёта открыты. Товары появляются после публикации в Shopify; онлайн-оплата ожидает проверки продавца.", status: "Каталог и расчёт", ready: true, href: "/insaat-magaza", link: "Открыть магазин стройматериалов" },
      { title: "Медиа и продвижение", text: "Доступны инструменты корпоративного контента и медиа; утверждённых объявлений и готовых к публикации пилотных записей нет.", status: "Цифровые инструменты", ready: true, href: "/staff/yonlendir", link: "Войти в рабочее пространство" },
    ],
    regions: [
      { title: "Турция", text: "Основной регион централизованной работы и координации с партнёрами." },
      { title: "Украина", text: "Региональное направление, оцениваемое в рамках международной сети." },
      { title: "Дубай / ОАЭ", text: "Регион изучается в рамках подготовки торговых и логистических связей." },
      { title: "Ирак", text: "Фокус оценки региональных торговых и операционных потребностей." },
    ],
    steps: ["Запрос", "Экспертная оценка", "Планирование", "Необходимое согласование", "Реализация и отчётность"],
    mediaEmpty: "Нет утверждённых объявлений или готовых к публикации пилотных записей.",
    mediaStatus: "Статус: ЧЕРНОВИК / ПОДГОТОВКА · Ответственный, дата и следующий шаг отслеживаются в рабочем пространстве.",
    contactTitle: "Хотите внести вклад в одно из направлений?",
    contactText: "Поделитесь проверяемой информацией о своей экспертизе, компании или региональных связях. Соответствие и роль оцениваются в рамках рабочего дела.",
    contactCta: "Связаться с нами",
    footer: "© MMT Global · Корпоративный раздел",
    languages: "Язык",
    menuOpen: "Открыть меню",
    menuClose: "Закрыть меню",
  },
};

const ids = ["kurumsal", "faaliyet", "uluslararasi-ag", "ortaklik", "iletisim"];

function SectionIntro({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return <div className="mmt-section-head"><div><p className="mmt-kicker">{kicker}</p><h2 className="mmt-h2">{title}</h2></div><p>{description}</p></div>;
}

export default function CorporateHomePage() {
  const { locale, setLocale } = useI18n();
  const text = copy[locale];
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="mmt-page">
      <div className="mmt-shell">
        <header className="mmt-topbar">
          <Link href="/" className="mmt-brand" aria-label="MMT Global" data-testid="link-corporate-home">
            <img className="mmt-logo" src="/logo.svg" alt="MMT Global" />
          </Link>
          <nav className="mmt-nav" aria-label={text.brand}>
            {text.nav.map((label, index) => <a href={`#${ids[index]}`} key={ids[index]} data-testid={`link-corporate-nav-${index}`}>{label}</a>)}
            <Link href="/staff/yonlendir" className="mmt-entry">{text.entry}<ArrowUpRight size={13} /></Link>
          </nav>
          <div className="mmt-toolbar">
            <label className="mmt-language-control">
              <span className="mmt-sr-only">{text.languages}</span>
              <select aria-label={text.languages} data-testid="select-corporate-language" value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
                <option value="tr">TR</option><option value="en">EN</option><option value="ar">AR</option><option value="ru">RU</option>
              </select>
            </label>
            <button className="mmt-menu-button" data-testid="button-corporate-menu" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? text.menuClose : text.menuOpen} aria-expanded={menuOpen}>
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
          <nav className={`mmt-mobile-menu ${menuOpen ? "open" : ""}`} aria-label={text.brand} aria-hidden={!menuOpen}>
            {text.nav.map((label, index) => <a href={`#${ids[index]}`} key={ids[index]} data-testid={`link-corporate-mobile-nav-${index}`} onClick={() => setMenuOpen(false)}>{label}</a>)}
            <Link href="/staff/yonlendir" className="mmt-entry" onClick={() => setMenuOpen(false)}>{text.entry}</Link>
          </nav>
        </header>
      </div>
      <main>
        <section id="kurumsal" className="mmt-shell mmt-hero">
          <div>
            <p className="mmt-kicker">{text.kicker}</p>
            <h1 className="mmt-h1">{text.title}</h1>
            <p className="mmt-lead">{text.lead}</p>
            <div className="mmt-hero-actions">
              <a className="mmt-button" data-testid="link-corporate-fields" href="#faaliyet">{text.fieldsCta}<ArrowRight size={15} /></a>
              <Link className="mmt-button secondary" data-testid="link-corporate-join" href="/b2b-agi/katil">{text.joinCta}<ArrowRight size={15} /></Link>
            </div>
          </div>
          <aside className="mmt-hero-note"><p className="mmt-kicker">{text.statusTitle}</p><p>{text.statusIntro}</p></aside>
        </section>
        <section id="faaliyet" className="mmt-shell mmt-section">
          <SectionIntro {...text.sections[0]} />
          <div className="mmt-field-grid">
            {text.fields.map((field, index) => <article className="mmt-field" key={field.title} data-testid={`card-corporate-area-${index}`}>
              <span className={`mmt-status ${field.ready ? "" : "prep"}`} data-testid={`status-corporate-area-${index}`}>{field.status}</span>
              <div><h3>{field.title}</h3><p>{field.text}</p>{field.href && <Link className="mmt-card-link" data-testid={`link-corporate-area-${index}`} href={field.href}>{field.link}<ArrowRight size={13} /></Link>}</div>
            </article>)}
          </div>
          <div className="mmt-more-links">
            <Link href="/birimler" data-testid="link-corporate-departments">{locale === "tr" ? "Tüm birimleri görüntüle" : locale === "en" ? "View all departments" : locale === "ar" ? "عرض جميع الأقسام" : "Все направления"}<ArrowRight size={14} /></Link>
            <Link href="/b2b-agi/katil" data-testid="link-corporate-business-join">{locale === "tr" ? "İşletme olarak katıl" : locale === "en" ? "Join as a business" : locale === "ar" ? "انضم كشركة" : "Присоединиться как компания"}<ArrowRight size={14} /></Link>
          </div>
        </section>
        <section id="uluslararasi-ag" className="mmt-shell mmt-section">
          <SectionIntro {...text.sections[1]} />
          <div className="mmt-regions">{text.regions.map((region) => <article className="mmt-region" key={region.title}><Globe2 size={17} className="mmt-region-icon" /><b>{region.title}</b><p>{region.text}</p></article>)}</div>
        </section>
        <section className="mmt-shell mmt-section">
          <SectionIntro {...text.sections[2]} />
          <div className="mmt-steps">{text.steps.map((step, index) => <div className="mmt-step" key={step}><span>0{index + 1}</span><b>{step}</b></div>)}</div>
        </section>
        <section className="mmt-shell mmt-section">
          <SectionIntro {...text.sections[3]} />
          <div className="mmt-empty" data-testid="status-corporate-media"><Megaphone size={16} /><span>{text.mediaEmpty}</span><small>{text.mediaStatus}</small></div>
        </section>
        <section id="ortaklik" className="mmt-shell mmt-section">
          <div className="mmt-contact"><div><p className="mmt-kicker">{text.sections[0].kicker.replace("01", "05")}</p><h2 className="mmt-h2">{text.contactTitle}</h2><p>{text.contactText}</p></div><Link href="/iletisim" data-testid="link-corporate-contact" className="mmt-button">{text.contactCta}<ArrowRight size={15} /></Link></div>
        </section>
        <footer id="iletisim" className="mmt-shell mmt-footer"><span>{text.footer}</span><span>TR / EN / AR / RU</span><Link href="/iletisim">{text.nav[4]}<ArrowUpRight size={12} /></Link></footer>
      </main>
    </div>
  );
}