import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-foreground px-6">
      <div className="w-12 h-12 bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl mb-8 rounded-br-xl rounded-tl-xl">
        M
      </div>
      <h1 className="text-8xl md:text-9xl font-serif italic text-primary mb-4">404</h1>
      <h2 className="text-2xl md:text-3xl font-semibold mb-6 text-center">Sayfa Bulunamadı</h2>
      <p className="text-foreground/60 mb-12 text-center max-w-md">
        Aradığınız sayfaya şu anda ulaşılamıyor veya taşınmış olabilir.
      </p>
      <Link href="/">
        <button className="px-6 py-3 bg-primary text-white hover:bg-primary/90 transition-colors uppercase tracking-wider text-sm font-semibold flex items-center gap-3">
          <ArrowLeft size={16} />
          Ana Sayfaya Dön
        </button>
      </Link>
    </div>
  );
}
