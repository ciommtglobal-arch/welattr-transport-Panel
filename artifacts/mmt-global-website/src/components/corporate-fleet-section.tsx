import { useState } from "react";
import { ArrowRight, CheckCircle2, Radar, Route, ShieldCheck, Truck } from "lucide-react";
import { useI18n, type Locale } from "@/lib/i18n";
import { getLocaleCopy, type CoreLocale } from "@/lib/locale-copy";

type CorridorId = "europe" | "mersin" | "gulf";

const corridorOrder: CorridorId[] = ["europe", "mersin", "gulf"];
const capabilityIcons = [Truck, ShieldCheck, Radar];

type FleetCopy = {
  sectionTitle: string;
  visionLabel: string;
  financeKicker: string;
  headline: string;
  description: string;
  capabilities: Array<{ title: string; description: string }>;
  requestInfo: string;
  demoLabel: string;
  flowTitle: string;
  routeLabel: string;
  operationsScenario: string;
  liveView: string;
  metrics: string[];
  transparencyTitle: string;
  transparencyNote: string;
  corridors: Record<
    CorridorId,
    {
      label: string;
      eyebrow: string;
      title: string;
      description: string;
      status: string;
    }
  >;
};

const fleetCopy: Record<CoreLocale, FleetCopy> = {
  tr: {
    sectionTitle: "KURUMSAL FİLO",
    visionLabel: "Operasyon vizyonu",
    financeKicker: "Finansmanı kapasiteye dönüştürmek",
    headline: "Kıtaları bağlayan kapasiteyi birlikte büyütüyoruz.",
    description:
      "MMT Global’in kurumsal büyüme yaklaşımı; mali gücü, filo ağını ve operasyonel görünürlüğü aynı plan içinde geliştirerek Avrupa, Akdeniz, Körfez ve Asya koridorlarında güvenilir lojistik hizmet sunmayı hedefler.",
    capabilities: [
      {
        title: "Filo kapasitesi",
        description:
          "Özmal ve iş ortağı araçlarını planlı, ölçülebilir bir operasyon yapısında birleştirme.",
      },
      {
        title: "Uyumlu büyüme",
        description:
          "Lisans, sigorta, sözleşme ve risk süreçlerini büyüme planının merkezinde tutma.",
      },
      {
        title: "Saha görünürlüğü",
        description:
          "Koridor, yük ve filo durumunu karar almayı kolaylaştıran dijital sinyallerle izleme.",
      },
    ],
    requestInfo: "Kurumsal bilgi talep edin",
    demoLabel: "Demo / koridor görünümü",
    flowTitle: "Kıtalar arası filo akışı",
    routeLabel: "MMT / ROUTE",
    operationsScenario: "Operasyon senaryosu",
    liveView: "LIVE VIEW / DEMO",
    metrics: ["Filo planlama", "Lisans & sigorta", "Saha görünürlüğü"],
    transparencyTitle: "Şeffaflık notu:",
    transparencyNote:
      "Bu ekran yalnızca kurumsal bilgilendirme ve operasyon vizyonu için hazırlanmış bir demodur. Gerçek para, cüzdan, yatırım, hisse veya getiri işlemi içermez.",
    corridors: {
      europe: {
        label: "AVRUPA",
        eyebrow: "01 / TEDARİK & YÜK GİRİŞİ",
        title: "İş ortağı ve acente ağıyla başlayan akış",
        description:
          "Kapasite planlaması, yük görünürlüğü ve uygun taşıma eşleştirmesi bu düğümde başlar.",
        status: "Planlama katmanı",
      },
      mersin: {
        label: "MERSİN HUB",
        eyebrow: "02 / TRANSİT MERKEZİ",
        title: "Türkiye üzerinden koordineli aktarma",
        description:
          "Gümrük, aktarma ve karayolu operasyonları için merkezi bir koordinasyon yaklaşımı.",
        status: "Operasyonel merkez",
      },
      gulf: {
        label: "KÖRFEZ & ASYA",
        eyebrow: "03 / VARIŞ AĞI",
        title: "Kıtalar arası hizmete açılan hat",
        description:
          "Varış noktalarındaki iş ortaklarıyla teslimat, raporlama ve müşteri iletişimi.",
        status: "Hizmet ağı",
      },
    },
  },
  en: {
    sectionTitle: "CORPORATE FLEET",
    visionLabel: "Operations vision",
    financeKicker: "Turning finance into capacity",
    headline: "Together, we grow the capacity that connects continents.",
    description:
      "MMT Global’s corporate growth approach develops financial strength, fleet capacity and operational visibility within one plan to deliver reliable logistics across the Europe, Mediterranean, Gulf and Asia corridors.",
    capabilities: [
      {
        title: "Fleet capacity",
        description:
          "Bringing owned and partner vehicles together in a planned, measurable operating structure.",
      },
      {
        title: "Compliant growth",
        description:
          "Keeping licensing, insurance, contracts and risk processes at the center of the growth plan.",
      },
      {
        title: "Field visibility",
        description:
          "Tracking corridor, cargo and fleet status through digital signals that make decisions easier.",
      },
    ],
    requestInfo: "REQUEST CORPORATE INFORMATION",
    demoLabel: "Demo / corridor view",
    flowTitle: "Intercontinental fleet flow",
    routeLabel: "MMT / ROUTE",
    operationsScenario: "Operations scenario",
    liveView: "LIVE VIEW / DEMO",
    metrics: ["Fleet planning", "Licensing & insurance", "Field visibility"],
    transparencyTitle: "Transparency note:",
    transparencyNote:
      "This screen is a demo prepared only for corporate information and operational vision. It does not contain real money, wallet, investment, share or return transactions.",
    corridors: {
      europe: {
        label: "EUROPE",
        eyebrow: "01 / SUPPLY & CARGO ENTRY",
        title: "A flow that begins with partners and agencies",
        description:
          "Capacity planning, cargo visibility and suitable transport matching begin at this node.",
        status: "Planning layer",
      },
      mersin: {
        label: "MERSIN HUB",
        eyebrow: "02 / TRANSIT CENTER",
        title: "Coordinated transfer through Türkiye",
        description:
          "A central coordination approach for customs, transfer and road operations.",
        status: "Operational center",
      },
      gulf: {
        label: "GULF & ASIA",
        eyebrow: "03 / DESTINATION NETWORK",
        title: "A corridor opening to intercontinental service",
        description:
          "Delivery, reporting and customer communication with partners at destination points.",
        status: "Service network",
      },
    },
  },
  ar: {
    sectionTitle: "الأسطول المؤسسي",
    visionLabel: "رؤية العمليات",
    financeKicker: "تحويل التمويل إلى قدرة تشغيلية",
    headline: "ننمي معاً القدرة التي تربط القارات.",
    description:
      "يطور نهج MMT Global للنمو المؤسسي القوة المالية وشبكة الأسطول والوضوح التشغيلي ضمن خطة واحدة لتقديم خدمات لوجستية موثوقة عبر ممرات أوروبا والمتوسط والخليج وآسيا.",
    capabilities: [
      {
        title: "قدرة الأسطول",
        description: "دمج المركبات المملوكة ومركبات الشركاء ضمن هيكل تشغيلي مخطط وقابل للقياس.",
      },
      {
        title: "نمو متوافق",
        description: "وضع التراخيص والتأمين والعقود وإدارة المخاطر في مركز خطة النمو.",
      },
      {
        title: "وضوح ميداني",
        description: "متابعة حالة الممرات والشحنات والأسطول عبر إشارات رقمية تسهّل اتخاذ القرار.",
      },
    ],
    requestInfo: "اطلبوا المعلومات المؤسسية",
    demoLabel: "عرض تجريبي / الممرات",
    flowTitle: "تدفق الأسطول بين القارات",
    routeLabel: "MMT / ROUTE",
    operationsScenario: "سيناريو العمليات",
    liveView: "عرض مباشر / تجريبي",
    metrics: ["تخطيط الأسطول", "التراخيص والتأمين", "الوضوح الميداني"],
    transparencyTitle: "ملاحظة الشفافية:",
    transparencyNote:
      "هذه الشاشة نموذج تجريبي للمعلومات المؤسسية والرؤية التشغيلية فقط. لا تتضمن معاملات مالية أو محفظة أو استثماراً أو أسهماً أو عوائد حقيقية.",
    corridors: {
      europe: {
        label: "أوروبا",
        eyebrow: "01 / التوريد ودخول الشحنات",
        title: "تدفق يبدأ من شبكة الشركاء والوكلاء",
        description: "يبدأ هنا تخطيط القدرة ووضوح الشحنات ومواءمة النقل المناسب.",
        status: "طبقة التخطيط",
      },
      mersin: {
        label: "مركز مرسين",
        eyebrow: "02 / مركز العبور",
        title: "نقل منسق عبر تركيا",
        description: "نهج تنسيق مركزي للجمارك والنقل وعمليات الطرق.",
        status: "المركز التشغيلي",
      },
      gulf: {
        label: "الخليج وآسيا",
        eyebrow: "03 / شبكة الوصول",
        title: "ممر يفتح الخدمة بين القارات",
        description: "التسليم والتقارير والتواصل مع العملاء عبر شركاء نقاط الوصول.",
        status: "شبكة الخدمات",
      },
    },
  },
  ru: {
    sectionTitle: "КОРПОРАТИВНЫЙ АВТОПАРК",
    visionLabel: "Операционная концепция",
    financeKicker: "Превращаем финансирование в мощности",
    headline: "Вместе развиваем мощности, соединяющие континенты.",
    description:
      "Корпоративный подход MMT Global развивает финансовую устойчивость, автопарк и операционную прозрачность в едином плане, чтобы предоставлять надёжные логистические услуги на направлениях Европы, Средиземноморья, Персидского залива и Азии.",
    capabilities: [
      {
        title: "Вместимость автопарка",
        description:
          "Объединяем собственный транспорт и машины партнёров в планируемой и измеримой операционной структуре.",
      },
      {
        title: "Устойчивый рост",
        description:
          "Лицензии, страхование, договоры и управление рисками остаются в центре плана роста.",
      },
      {
        title: "Полевой обзор",
        description:
          "Отслеживаем коридоры, грузы и состояние автопарка с помощью цифровых сигналов для принятия решений.",
      },
    ],
    requestInfo: "ЗАПРОСИТЬ КОРПОРАТИВНУЮ ИНФОРМАЦИЮ",
    demoLabel: "Демо / обзор коридоров",
    flowTitle: "Межконтинентальный поток автопарка",
    routeLabel: "MMT / ROUTE",
    operationsScenario: "Операционный сценарий",
    liveView: "ПРЯМОЙ ОБЗОР / ДЕМО",
    metrics: ["Планирование автопарка", "Лицензии и страхование", "Полевой обзор"],
    transparencyTitle: "Примечание о прозрачности:",
    transparencyNote:
      "Этот экран является демо только для корпоративной информации и операционной концепции. Он не содержит операций с реальными деньгами, кошельком, инвестициями, акциями или доходностью.",
    corridors: {
      europe: {
        label: "ЕВРОПА",
        eyebrow: "01 / ПОСТАВКИ И ВХОД ГРУЗА",
        title: "Поток начинается с сети партнёров и агентств",
        description:
          "На этом узле начинаются планирование мощностей, обзор груза и подбор подходящей перевозки.",
        status: "Слой планирования",
      },
      mersin: {
        label: "ХАБ МЕРСИН",
        eyebrow: "02 / ТРАНЗИТНЫЙ ЦЕНТР",
        title: "Координированная перегрузка через Турцию",
        description:
          "Центральный подход к координации таможни, перегрузки и автомобильных операций.",
        status: "Операционный центр",
      },
      gulf: {
        label: "ЗАЛИВ И АЗИЯ",
        eyebrow: "03 / СЕТЬ НАЗНАЧЕНИЯ",
        title: "Коридор для межконтинентальных услуг",
        description:
          "Доставка, отчётность и связь с клиентами при участии партнёров в пунктах назначения.",
        status: "Сеть услуг",
      },
    },
  },
};

export default function CorporateFleetSection({ onContact }: { onContact: () => void }) {
  const { locale } = useI18n();
  const copy = getLocaleCopy(fleetCopy, locale);
  const [activeCorridor, setActiveCorridor] = useState<CorridorId>("mersin");
  const corridor = copy.corridors[activeCorridor];

  return (
    <section
      id="corporate-fleet"
      className="relative overflow-hidden bg-secondary px-6 py-24 text-secondary-foreground md:px-12 md:py-32"
    >
      <div className="absolute inset-0 opacity-[0.08]" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-16 flex items-center gap-6 md:mb-24">
          <span className="font-mono text-sm tracking-widest text-primary">03</span>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-secondary-foreground/60">
            {copy.sectionTitle}
          </h2>
          <div className="h-px flex-1 bg-secondary-foreground/15" />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-secondary-foreground/50 sm:inline">
            {copy.visionLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="flex flex-col justify-center">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              {copy.financeKicker}
            </p>
            <h3 className="mb-8 max-w-xl text-4xl font-serif italic leading-tight md:text-6xl">
              {copy.headline}
            </h3>
            <p className="mb-10 max-w-xl text-lg font-light leading-relaxed text-secondary-foreground/70">
              {copy.description}
            </p>

            <div className="space-y-6">
              {copy.capabilities.map(({ title, description }, index) => {
                const Icon = capabilityIcons[index];
                return (
                  <div key={title} className="flex gap-4 border-t border-secondary-foreground/15 pt-5">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-foreground">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="mb-1 text-sm font-semibold uppercase tracking-wider">{title}</h4>
                      <p className="text-sm leading-relaxed text-secondary-foreground/60">{description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onContact}
              className="group mt-10 flex w-fit items-center gap-3 border-b border-primary pb-2 text-sm font-semibold uppercase tracking-wider"
            >
              {copy.requestInfo}
              <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-2" />
            </button>
          </div>

          <div className="relative overflow-hidden rounded-tl-[2.5rem] rounded-br-[2.5rem] bg-background p-5 text-foreground shadow-2xl shadow-black/10 md:p-7">
            <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                    {copy.demoLabel}
                  </span>
                </div>
                <h4 className="text-xl font-semibold">{copy.flowTitle}</h4>
              </div>
              <div className="flex items-center gap-2 border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-foreground/50">
                <Route className="h-3.5 w-3.5 text-primary" />
                {copy.routeLabel}
              </div>
            </div>

            <div className="mt-7 rounded-2xl border border-border bg-card p-4 md:p-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45">
                  {copy.operationsScenario}
                </span>
                <span className="font-mono text-[10px] text-primary">{copy.liveView}</span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
                {corridorOrder.map((id, index) => {
                  const item = copy.corridors[id];
                  return (
                    <div key={id} className="contents">
                      <button
                        type="button"
                        onClick={() => setActiveCorridor(id)}
                        className={`min-h-20 border p-3 text-left transition-colors ${
                          activeCorridor === id
                            ? "border-primary bg-primary/10"
                            : "border-border bg-background hover:border-primary/60"
                        }`}
                        aria-pressed={activeCorridor === id}
                      >
                        <span className="mb-2 block font-mono text-[9px] tracking-[0.16em] text-foreground/45">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="block text-[11px] font-semibold tracking-wide">{item.label}</span>
                      </button>
                      {index < 2 && <span className="text-center font-mono text-primary">→</span>}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-border pt-5">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
                    {corridor.eyebrow}
                  </span>
                  <span className="text-[10px] text-foreground/45">{corridor.status}</span>
                </div>
                <h5 className="mb-2 text-lg font-semibold">{corridor.title}</h5>
                <p className="max-w-lg text-sm leading-relaxed text-foreground/60">{corridor.description}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {copy.metrics.map((label) => (
                <div key={label} className="flex items-center gap-2 border border-border px-3 py-3 text-[11px] text-foreground/60">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-6 border-l-2 border-primary bg-primary/10 px-4 py-3 text-xs leading-relaxed text-foreground/65">
              <strong className="font-semibold text-foreground">{copy.transparencyTitle}</strong>{" "}
              {copy.transparencyNote}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}