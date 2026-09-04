import { useState } from "react";
import { ArrowRight, CheckCircle2, Radar, Route, ShieldCheck, Truck } from "lucide-react";

type CorridorId = "europe" | "mersin" | "gulf";

const corridors: Record<
  CorridorId,
  {
    label: string;
    eyebrow: string;
    title: string;
    description: string;
    status: string;
  }
> = {
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
};

const capabilities = [
  {
    icon: Truck,
    title: "Filo kapasitesi",
    description:
      "Özmal ve iş ortağı araçlarını planlı, ölçülebilir bir operasyon yapısında birleştirme.",
  },
  {
    icon: ShieldCheck,
    title: "Uyumlu büyüme",
    description:
      "Lisans, sigorta, sözleşme ve risk süreçlerini büyüme planının merkezinde tutma.",
  },
  {
    icon: Radar,
    title: "Saha görünürlüğü",
    description:
      "Koridor, yük ve filo durumunu karar almayı kolaylaştıran dijital sinyallerle izleme.",
  },
];

export default function CorporateFleetSection({ onContact }: { onContact: () => void }) {
  const [activeCorridor, setActiveCorridor] = useState<CorridorId>("mersin");
  const corridor = corridors[activeCorridor];

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
            KURUMSAL FİLO
          </h2>
          <div className="h-px flex-1 bg-secondary-foreground/15" />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-secondary-foreground/50 sm:inline">
            Operasyon vizyonu
          </span>
        </div>

        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="flex flex-col justify-center">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Finansmanı kapasiteye dönüştürmek
            </p>
            <h3 className="mb-8 max-w-xl text-4xl font-serif italic leading-tight md:text-6xl">
              Kıtaları bağlayan kapasiteyi birlikte büyütüyoruz.
            </h3>
            <p className="mb-10 max-w-xl text-lg font-light leading-relaxed text-secondary-foreground/70">
              MMT Global’in kurumsal büyüme yaklaşımı; mali gücü, filo ağını ve operasyonel
              görünürlüğü aynı plan içinde geliştirerek Avrupa, Akdeniz, Körfez ve Asya
              koridorlarında güvenilir lojistik hizmet sunmayı hedefler.
            </p>

            <div className="space-y-6">
              {capabilities.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex gap-4 border-t border-secondary-foreground/15 pt-5">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-foreground">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="mb-1 text-sm font-semibold uppercase tracking-wider">{title}</h4>
                    <p className="text-sm leading-relaxed text-secondary-foreground/60">{description}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onContact}
              className="group mt-10 flex w-fit items-center gap-3 border-b border-primary pb-2 text-sm font-semibold uppercase tracking-wider"
            >
              Kurumsal bilgi talep edin
              <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-2" />
            </button>
          </div>

          <div className="relative overflow-hidden rounded-tl-[2.5rem] rounded-br-[2.5rem] bg-background p-5 text-foreground shadow-2xl shadow-black/10 md:p-7">
            <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                    Demo / koridor görünümü
                  </span>
                </div>
                <h4 className="text-xl font-semibold">Kıtalar arası filo akışı</h4>
              </div>
              <div className="flex items-center gap-2 border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-foreground/50">
                <Route className="h-3.5 w-3.5 text-primary" />
                MMT / ROUTE
              </div>
            </div>

            <div className="mt-7 rounded-2xl border border-border bg-card p-4 md:p-5">
              <div className="mb-5 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/45">
                  Operasyon senaryosu
                </span>
                <span className="font-mono text-[10px] text-primary">LIVE VIEW / DEMO</span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
                {(Object.entries(corridors) as [CorridorId, (typeof corridors)[CorridorId]][]).map(
                  ([id, item], index) => (
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
                  ),
                )}
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
              {["Filo planlama", "Lisans & sigorta", "Saha görünürlüğü"].map((label) => (
                <div key={label} className="flex items-center gap-2 border border-border px-3 py-3 text-[11px] text-foreground/60">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-6 border-l-2 border-primary bg-primary/10 px-4 py-3 text-xs leading-relaxed text-foreground/65">
              <strong className="font-semibold text-foreground">Şeffaflık notu:</strong> Bu ekran yalnızca
              kurumsal bilgilendirme ve operasyon vizyonu için hazırlanmış bir demodur. Gerçek para, cüzdan,
              yatırım, hisse veya getiri işlemi içermez.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}