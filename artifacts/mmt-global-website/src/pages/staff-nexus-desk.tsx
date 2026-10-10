import { useAuth } from "@clerk/react";
import { Link, Redirect } from "wouter";
import { useGetNexusIntakes } from "@workspace/api-client-react";

export default function StaffNexusDesk() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  if (!isLoaded) return <main aria-busy="true">Oturum kontrol ediliyor…</main>;
  if (!isSignedIn) return <Redirect to="/staff/giris" />;
  return <NexusDesk userId={userId!} />;
}

function NexusDesk({ userId }: { userId: string }) {
  const list = useGetNexusIntakes({ query: {
    queryKey: ["/api/nexus/intakes", userId], retry: false, staleTime: 0, refetchInterval: 30000,
  } });
  const labels = {
    PENDING_FOUNDER_APPROVAL: "Kurucu Onayı Bekliyor",
    FOUNDER_APPROVED: "Kurucu Onayladı",
    FOUNDER_REJECTED: "Kurucu Reddetti",
  };
  return <main className="min-h-screen bg-background text-foreground">
    <section className="mx-auto max-w-5xl px-5 py-10">
      <Link href="/staff/yonetim-paneli" className="text-sm text-primary">Yönetim paneline dön</Link>
      <p className="mt-8 font-mono text-xs uppercase tracking-widest text-primary">MMT Global / MMT Nexus</p>
      <h1 className="mt-3 text-3xl font-semibold">Çelik Kubbe denetim masası</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
        Shopify’dan gelen rezervasyonlar ve finansman ilgi kayıtları. Gelen bildirim kurucu onayı değildir.
        Finansman ürününün siparişi, belgeleri tamamlanmış banka başvurusu değildir.
        Bu masa para aktarmaz, Shopify ödemelerini durdurmaz ve rezervasyonu kesinleştirmez.
      </p>
      <button onClick={() => list.refetch()} disabled={list.isFetching}
        className="my-6 min-h-11 border border-border px-5 text-sm">Yenile</button>
      {list.isLoading ? <p aria-busy="true">Kayıtlar yükleniyor…</p> : list.isError ?
        <div role="alert" className="border border-border p-6">
          Kayıtlar alınamadı. Kurucu oturumu, mağaza yapılandırması ve veritabanı şeması hazır olmalıdır.
          Başka bir mağazanın verileri gösterilmez.
        </div> : !list.data?.length ?
        <p className="border border-border p-6">Bu mağazadan alınmış denetim kaydı yok. Bu, canlı webhook bağlantısının doğrulandığı anlamına gelmez.</p> :
        <ul className="space-y-4">{list.data.map(row => <li key={row.id} className="border border-border p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="font-semibold">{row.orderName} · {row.productTitle}</h2>
            <span className="text-sm text-primary">{labels[row.status]}</span>
          </div>
          <p className="mt-3 text-sm">{row.kind === "reservation" ? "Rezervasyon kaydı" : "Finansman ilgi kaydı"} · {row.quantity} adet · Birim tutar: {row.unitPrice} {row.currency}</p>
          <p className="mt-2 text-xs text-muted-foreground">Kaynak: {row.shopDomain} · Shopify ödeme durumu: {row.financialStatus} · {new Date(row.createdAt).toLocaleString("tr-TR")}</p>
          {row.cancelled === 1 && <p className="mt-3 text-sm text-destructive">Shopify siparişi iptal edilmiş. Kurucu kararının yerine geçmez.</p>}
          {row.warning && <p className="mt-3 text-sm text-destructive">{row.warning}</p>}
        </li>)}</ul>}
      <p className="mt-6 text-xs text-muted-foreground">Son 100 kayıt gösterilir. Bu aşamada karar veya dış işlem düğmesi yoktur; otomatik onay verilmez.</p>
    </section>
  </main>;
}
