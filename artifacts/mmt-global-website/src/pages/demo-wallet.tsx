import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, Coins, RotateCcw, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "wouter";

const DEMO_STORAGE_KEY = "mmt-global-demo-wallet";
const COMMISSION_RATE = 0.0075;

const instruments = [
  { symbol: "KOR-01", name: "Avrupa Koridoru", price: 128, change: 4.2 },
  { symbol: "HUB-02", name: "Mersin Hub", price: 96, change: 1.8 },
  { symbol: "ASI-03", name: "Körfez & Asya Hattı", price: 74, change: -0.9 },
];

type TradeSide = "buy" | "sell";

type DemoTrade = {
  id: string;
  side: TradeSide;
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  commission: number;
  total: number;
  createdAt: string;
};

type DemoWalletState = {
  balance: number;
  holdings: Record<string, number>;
  commissionEarned: number;
  trades: DemoTrade[];
};

const initialState: DemoWalletState = {
  balance: 50_000,
  holdings: {},
  commissionEarned: 0,
  trades: [],
};

function readDemoState(): DemoWalletState {
  if (typeof window === "undefined") return initialState;

  try {
    const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!stored) return initialState;
    const parsed = JSON.parse(stored) as Partial<DemoWalletState>;
    return {
      balance: typeof parsed.balance === "number" ? parsed.balance : initialState.balance,
      holdings: parsed.holdings ?? {},
      commissionEarned:
        typeof parsed.commissionEarned === "number" ? parsed.commissionEarned : initialState.commissionEarned,
      trades: Array.isArray(parsed.trades) ? parsed.trades : [],
    };
  } catch {
    return initialState;
  }
}

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function DemoWallet() {
  const [wallet, setWallet] = useState<DemoWalletState>(initialState);
  const [side, setSide] = useState<TradeSide>("buy");
  const [instrumentSymbol, setInstrumentSymbol] = useState(instruments[0].symbol);
  const [quantity, setQuantity] = useState("10");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setWallet(readDemoState());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(wallet));
  }, [wallet]);

  const instrument = instruments.find((item) => item.symbol === instrumentSymbol) ?? instruments[0];
  const numericQuantity = Math.max(0, Number(quantity) || 0);
  const gross = numericQuantity * instrument.price;
  const commission = gross * COMMISSION_RATE;
  const total = side === "buy" ? gross + commission : gross - commission;
  const heldQuantity = wallet.holdings[instrument.symbol] ?? 0;

  const portfolioValue = useMemo(
    () =>
      instruments.reduce(
        (value, item) => value + (wallet.holdings[item.symbol] ?? 0) * item.price,
        0,
      ),
    [wallet.holdings],
  );

  function handleTrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!numericQuantity || numericQuantity <= 0) {
      setMessage("İşlem miktarı sıfırdan büyük olmalıdır.");
      return;
    }

    if (side === "buy" && total > wallet.balance) {
      setMessage("Demo bakiyeniz bu işlem için yeterli değil.");
      return;
    }

    if (side === "sell" && numericQuantity > heldQuantity) {
      setMessage(`Bu demo varlıktan yalnızca ${formatNumber(heldQuantity)} biriminiz var.`);
      return;
    }

    const trade: DemoTrade = {
      id: `${Date.now()}-${instrument.symbol}`,
      side,
      symbol: instrument.symbol,
      name: instrument.name,
      quantity: numericQuantity,
      price: instrument.price,
      commission,
      total,
      createdAt: new Date().toISOString(),
    };

    setWallet((current) => ({
      balance: side === "buy" ? current.balance - total : current.balance + total,
      holdings: {
        ...current.holdings,
        [instrument.symbol]:
          (current.holdings[instrument.symbol] ?? 0) +
          (side === "buy" ? numericQuantity : -numericQuantity),
      },
      commissionEarned: current.commissionEarned + commission,
      trades: [trade, ...current.trades].slice(0, 12),
    }));
    setMessage(`Demo ${side === "buy" ? "alım" : "satım"} işlemi tamamlandı.`);
  }

  function resetWallet() {
    setWallet(initialState);
    setMessage("Demo cüzdan başlangıç durumuna döndürüldü.");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-12">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-br-xl rounded-tl-xl bg-primary text-lg font-bold text-primary-foreground transition-transform group-hover:scale-95">
              M
            </span>
            <span className="text-lg font-semibold tracking-wider">
              MMT <span className="font-light opacity-80">GLOBAL</span>
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/65 transition-colors hover:text-primary"
          >
            <ArrowLeft size={15} />
            Ana sayfa
          </Link>
        </div>
      </header>

      <section className="border-b border-border/70 bg-secondary px-6 py-14 text-secondary-foreground md:px-12 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <span className="rounded-full border border-primary/40 px-3 py-1">DEMO</span>
            Gerçek para yok
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
            Cüzdan akışını
            <span className="block font-serif font-normal italic text-primary">güvenle test edin.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70">
            Bu ekran yalnızca ürün akışı, sanal bakiye ve şeffaf komisyon hesabını denemek içindir.
            Para yatırma, para çekme, gerçek varlık veya yatırım hizmeti sunmaz.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-10 md:px-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard label="Demo nakit" value={`${formatNumber(wallet.balance)} puan`} icon={<Coins />} />
            <SummaryCard label="Portföy değeri" value={`${formatNumber(portfolioValue)} puan`} icon={<TrendingUp />} />
            <SummaryCard
              label="Hesaplanan komisyon"
              value={`${formatNumber(wallet.commissionEarned)} puan`}
              icon={<ShieldCheck />}
            />
          </div>

          <section className="border border-border/70 bg-card p-6 md:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Sanal varlıklar</p>
                <h2 className="mt-2 text-2xl font-semibold">Demo piyasa görünümü</h2>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-[10px] text-primary">SIMÜLASYON</span>
            </div>
            <div className="space-y-3">
              {instruments.map((item) => {
                const holding = wallet.holdings[item.symbol] ?? 0;
                return (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => setInstrumentSymbol(item.symbol)}
                    className={`flex w-full items-center justify-between border p-4 text-left transition-colors ${
                      item.symbol === instrument.symbol
                        ? "border-primary bg-primary/5"
                        : "border-border/70 hover:border-primary/60"
                    }`}
                  >
                    <span>
                      <span className="block font-mono text-xs text-primary">{item.symbol}</span>
                      <span className="mt-1 block font-semibold">{item.name}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-sm">{formatNumber(item.price)} puan</span>
                      <span className={`mt-1 block text-xs ${item.change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {item.change >= 0 ? "+" : ""}
                        {formatNumber(item.change, 1)}% · {formatNumber(holding)} adet
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="border border-border/70 bg-card p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">İşlem günlüğü</p>
                <h2 className="mt-2 text-2xl font-semibold">Son demo işlemleri</h2>
              </div>
              <button
                type="button"
                onClick={resetWallet}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/55 hover:text-primary"
              >
                <RotateCcw size={14} />
                Sıfırla
              </button>
            </div>
            {wallet.trades.length === 0 ? (
              <p className="border border-dashed border-border p-6 text-sm text-foreground/55">
                Henüz demo işlemi yok. Sağdaki panelden ilk sanal alım veya satımınızı oluşturun.
              </p>
            ) : (
              <div className="space-y-3">
                {wallet.trades.map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between gap-4 border-b border-border/70 pb-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        trade.side === "buy" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"
                      }`}>
                        {trade.side === "buy" ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                      </span>
                      <span>
                        <span className="block font-semibold">
                          {trade.side === "buy" ? "Alım" : "Satım"} · {trade.symbol}
                        </span>
                        <span className="block text-xs text-foreground/50">{formatDate(trade.createdAt)}</span>
                      </span>
                    </div>
                    <span className="text-right">
                      <span className="block font-mono">{formatNumber(trade.quantity)} adet</span>
                      <span className="block text-xs text-foreground/50">Komisyon {formatNumber(trade.commission)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="h-fit border border-border/70 bg-secondary p-6 text-secondary-foreground md:p-8 lg:sticky lg:top-6">
          <div className="mb-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">İşlem simülatörü</p>
            <h2 className="mt-2 text-3xl font-semibold">Sanal emir oluştur</h2>
          </div>

          <div className="mb-6 grid grid-cols-2 border border-secondary-foreground/15">
            {(["buy", "sell"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSide(item)}
                className={`py-3 text-xs font-semibold uppercase tracking-wider ${
                  side === item ? "bg-primary text-white" : "text-secondary-foreground/60 hover:text-secondary-foreground"
                }`}
              >
                {item === "buy" ? "Alım" : "Satım"}
              </button>
            ))}
          </div>

          <form onSubmit={handleTrade} className="space-y-5">
            <label className="block text-sm">
              <span className="mb-2 block text-secondary-foreground/60">Sanal varlık</span>
              <select
                value={instrument.symbol}
                onChange={(event) => setInstrumentSymbol(event.target.value)}
                className="w-full border border-secondary-foreground/20 bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
              >
                {instruments.map((item) => (
                  <option key={item.symbol} value={item.symbol}>
                    {item.symbol} · {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-2 block text-secondary-foreground/60">Miktar</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="w-full border border-secondary-foreground/20 bg-background px-4 py-3 text-foreground outline-none focus:border-primary"
              />
            </label>

            <div className="space-y-3 border-t border-secondary-foreground/15 pt-5 text-sm">
              <LineItem label="Birim fiyat" value={`${formatNumber(instrument.price)} puan`} />
              <LineItem label="Brüt tutar" value={`${formatNumber(gross)} puan`} />
              <LineItem label={`Demo komisyon (%${formatNumber(COMMISSION_RATE * 100, 2)})`} value={`${formatNumber(commission)} puan`} />
              <div className="flex items-center justify-between border-t border-secondary-foreground/15 pt-3 font-semibold">
                <span>{side === "buy" ? "Toplam maliyet" : "Net tutar"}</span>
                <span className="font-mono text-primary">{formatNumber(total)} puan</span>
              </div>
            </div>

            {message && (
              <p className="border border-primary/30 bg-primary/10 p-3 text-sm text-secondary-foreground/80">{message}</p>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 bg-primary px-5 py-4 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90"
            >
              {side === "buy" ? "Demo alımı oluştur" : "Demo satımı oluştur"}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-7 flex gap-3 border-t border-secondary-foreground/15 pt-5 text-xs leading-relaxed text-secondary-foreground/55">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Bu işlem gerçek para, gerçek varlık veya çekilebilir kazanç oluşturmaz. Komisyon yalnızca ürün testi amacıyla hesaplanır.
          </div>
        </section>
      </section>
    </main>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="border border-border/70 bg-card p-5">
      <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <p className="text-xs uppercase tracking-wider text-foreground/50">{label}</p>
      <p className="mt-2 font-mono text-lg">{value}</p>
    </div>
  );
}

function LineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-secondary-foreground/65">
      <span>{label}</span>
      <span className="font-mono text-secondary-foreground">{value}</span>
    </div>
  );
}