import { useState } from "react";
import { CorporateHome } from "./CorporateHome";
import { FounderOverview } from "./FounderOverview";
import { ExpertOverview } from "./ExpertOverview";
import "./_shared/mobile-review.css";

type Screen = "home" | "founder" | "expert";

const screens: { id: Screen; label: string }[] = [
  { id: "home", label: "Ana sayfa" },
  { id: "founder", label: "Kurucu" },
  { id: "expert", label: "Uzman" },
];

export function MobileReview() {
  const requestedScreen = new URLSearchParams(window.location.search).get("screen");
  const initialScreen = screens.find(({ id }) => id === requestedScreen)?.id ?? "expert";
  const [screen, setScreen] = useState<Screen>(initialScreen);

  return (
    <div className="mmt-review">
      <nav className="mmt-review-nav" aria-label="Tasarım önizlemeleri">
        <span className="mmt-review-caption">MMT GLOBAL · SADECE GELİŞTİRME ÖNİZLEMESİ</span>
        <div className="mmt-review-tabs">
          {screens.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-current={screen === id ? "page" : undefined}
              onClick={() => {
                setScreen(id);
                window.scrollTo({ top: 0, behavior: "instant" });
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      {screen !== "home" && (
        <details className="mmt-review-policy">
          <summary>Katılım ve yetki yaklaşımı · taslak</summary>
          <p>
            Bu önizlemede personel veya atanmış yönetici yoktur. Önerilen süreç:
            başvuru → alan değerlendirmesi → pratik test → gözetimli görev →
            ilgili alanda kademeli yetki. Bu bir tasarımdır; gerçek hesap,
            görev veya erişim hakkı değiştirilmedi.
          </p>
        </details>
      )}
      {screen === "home" && <CorporateHome />}
      {screen === "founder" && <FounderOverview />}
      {screen === "expert" && <ExpertOverview />}
    </div>
  );
}