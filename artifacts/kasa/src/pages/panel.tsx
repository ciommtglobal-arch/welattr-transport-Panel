import { Link } from 'wouter';
import { Building2, ListChecks, PlusCircle } from 'lucide-react';
import { Notice, PageHeader } from '@/components/kit';
import { useMe } from '@/private/Gate';
import { useBranches } from '@/lib/branches';

export default function PanelPage() {
  const me = useMe();
  const b = useBranches();
  const tile = 'rise group flex items-center gap-3 rounded-lg border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary';
  return (
    <>
      <title>Panel | MMT Kasa</title>
      <PageHeader title={`Merhaba, ${me.name}`} sub={me.role === 'admin' ? 'Yönetici olarak oturum açtınız.' : `Kasiyer olarak oturum açtınız. Şubeniz: ${me.branchId ? b.name(me.branchId) : 'atanmamış'}.`} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/requests/new" className={tile} data-testid="tile-new-request"><PlusCircle className="h-6 w-6 text-primary" /><span><b className="block">Yeni talep</b><span className="text-sm text-muted-foreground">Bekleyen ödeme talebi oluştur</span></span></Link>
        <Link href="/requests" className={tile} data-testid="tile-requests"><ListChecks className="h-6 w-6 text-primary" /><span><b className="block">Talepler</b><span className="text-sm text-muted-foreground">{me.role === 'admin' ? 'Tüm şubelerin talepleri' : 'Kendi açtığınız talepler'}</span></span></Link>
        {me.role === 'admin' && <Link href="/branches" className={tile} data-testid="tile-branches"><Building2 className="h-6 w-6 text-primary" /><span><b className="block">Şubeler</b><span className="text-sm text-muted-foreground">Şube ekle, düzenle, pasifleştir</span></span></Link>}
      </div>
      <div className="mt-6 space-y-3">
        {me.role === 'cashier' && !me.branchId && <Notice tone="warn">Hesabınıza henüz aktif bir şube atanmamış; talep açmak için yöneticinizden şube ataması isteyin.</Notice>}
        <Notice>Canlı ödeme kapalıdır. Bekleyen talepler gelir sayılmaz; yalnızca tahsil edildi durumundaki kayıtlar gelirdir.</Notice>
      </div>
    </>
  );
}
