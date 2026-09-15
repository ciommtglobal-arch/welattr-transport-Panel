import { useEffect, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, Mail, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

type PageMeta = {
  title: string;
  description: string;
};

function usePageMeta({ title, description }: PageMeta) {
  useEffect(() => {
    document.title = title;
    let descriptionTag = document.querySelector('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement("meta");
      descriptionTag.setAttribute("name", "description");
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute("content", description);
  }, [title, description]);
}

function PageShell({
  eyebrow,
  title,
  highlight,
  description,
  meta,
  children,
}: {
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  meta: PageMeta;
  children: ReactNode;
}) {
  usePageMeta(meta);

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
          <div className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <ShieldCheck size={15} />
            {eyebrow}
          </div>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
            {title}
            <span className="block font-serif font-normal italic text-primary">{highlight}</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg font-light leading-relaxed text-secondary-foreground/70">
            {description}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12 md:px-12 md:py-20">{children}</section>
    </main>
  );
}

function ContentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border/70 py-8 first:pt-0 last:border-b-0">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-base leading-8 text-foreground/70">{children}</div>
    </section>
  );
}

function ContactCta({ label = "İletişime geçin" }: { label?: string }) {
  return (
    <Link
      href="/"
      className="mt-8 inline-flex items-center gap-2 bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90"
    >
      {label}
      <ArrowRight size={16} />
    </Link>
  );
}

export function PrivacyPage() {
  return (
    <PageShell
      eyebrow="Gizlilik"
      title="Verileriniz"
      highlight="kontrolünüzde."
      description="MMT Global, kişisel bilgileri yalnızca açık bir amaç ve güvenli bir hizmet sunmak için işler."
      meta={{
        title: "Gizlilik Politikası | MMT Global",
        description: "MMT Global web sitesinde kişisel verilerin nasıl toplandığını, kullanıldığını ve korunduğunu açıklayan gizlilik politikası.",
      }}
    >
      <ContentSection title="Kapsam">
        <p>
          Bu politika MMT Global web sitesini, iletişim formlarını, başvuru alanlarını ve
          ödeme akışını kapsar. Kart bilgileri MMT Global sisteminde tutulmaz; ödeme
          adımında yetkili ödeme sağlayıcının güvenli sayfası kullanılır.
        </p>
      </ContentSection>
      <ContentSection title="Toplanan bilgiler">
        <p>
          İletişim, başvuru veya ödeme talebi sırasında ad soyad, e-posta, telefon,
          talep açıklaması ve işlem bilgileri alınabilir. Kart numarası, CVV ve son
          kullanma tarihi ödeme formumuzda istenmez.
        </p>
      </ContentSection>
      <ContentSection title="Kullanım amaçları">
        <p>
          Bilgiler talepleri yanıtlamak, başvuruları değerlendirmek, ödeme oturumunu
          takip etmek, güvenliği sağlamak ve yasal yükümlülükleri yerine getirmek için
          kullanılır. Veriler pazarlama amacıyla paylaşılmaz.
        </p>
      </ContentSection>
      <ContentSection title="Paylaşım ve saklama">
        <p>
          Bilgiler yalnızca hizmetin yürütülmesi için gerekli hizmet sağlayıcılarla,
          yetkili kamu kurumlarıyla veya yasal zorunluluk hâlinde paylaşılır. Veriler,
          toplama amacının gerektirdiği süre boyunca ve güvenli erişim kontrolleriyle
          saklanır.
        </p>
      </ContentSection>
      <ContentSection title="Talepleriniz">
        <p>
          Kişisel verilerinizle ilgili bilgi, düzeltme, silme veya işleme itirazı
          taleplerinizi{" "}
          <a className="font-semibold text-primary hover:underline" href="mailto:info@mmtglobal.com">
            info@mmtglobal.com
          </a>{" "}
          adresine iletebilirsiniz.
        </p>
      </ContentSection>
    </PageShell>
  );
}

export function CookiePage() {
  return (
    <PageShell
      eyebrow="Çerezler"
      title="Daha iyi bir"
      highlight="deneyim."
      description="Çerezler ve benzer teknolojiler, sitenin çalışması ve tercihlerin hatırlanması için kullanılır."
      meta={{
        title: "Çerez Politikası | MMT Global",
        description: "MMT Global web sitesinde kullanılan zorunlu ve tercih çerezleri hakkında bilgi.",
      }}
    >
      <ContentSection title="Çerez nedir?">
        <p>
          Çerez, bir web sitesini ziyaret ettiğinizde tarayıcınıza kaydedilen küçük
          metin dosyasıdır. Oturumun korunması, güvenli giriş ve temel site
          işlevlerinin çalışması için kullanılabilir.
        </p>
      </ContentSection>
      <ContentSection title="Kullandığımız çerezler">
        <p>
          Zorunlu çerezler güvenli oturum, yönlendirme ve form işlevleri için gereklidir.
          Tercih çerezleri dil veya görüntüleme tercihleri gibi seçimleri hatırlayabilir.
          Zorunlu olmayan teknolojiler devreye alınırsa ayrıca bilgilendirme ve tercih
          seçimi sunulur.
        </p>
      </ContentSection>
      <ContentSection title="Kontrol seçenekleri">
        <p>
          Tarayıcı ayarlarınızdan çerezleri silebilir, engelleyebilir veya yeni çerez
          oluşturulduğunda uyarı alabilirsiniz. Zorunlu çerezleri engellemek bazı site
          özelliklerinin çalışmamasına neden olabilir.
        </p>
      </ContentSection>
    </PageShell>
  );
}

export function KvkkPage() {
  return (
    <PageShell
      eyebrow="KVKK"
      title="Açık ve"
      highlight="sorumlu."
      description="Kişisel verilerinizi 6698 sayılı Kanun çerçevesinde, amaca bağlı ve ölçülü biçimde işleriz."
      meta={{
        title: "KVKK Aydınlatma Metni | MMT Global",
        description: "MMT Global kişisel verilerin korunması ve ilgili kişi hakları hakkında KVKK aydınlatma metni.",
      }}
    >
      <ContentSection title="Veri sorumlusu">
        <p>
          Bu web sitesinin veri sorumlusu MMT Global Finance markası altında hizmet
          sunan kuruluştur. İletişim ve veri talepleri için{" "}
          <a className="font-semibold text-primary hover:underline" href="mailto:info@mmtglobal.com">
            info@mmtglobal.com
          </a>{" "}
          adresini kullanabilirsiniz.
        </p>
      </ContentSection>
      <ContentSection title="İşleme amaçları ve hukuki sebepler">
        <p>
          Veriler; iletişim talebini sonuçlandırmak, başvuru veya ödeme sürecini
          yürütmek, bilgi güvenliğini sağlamak ve hukuki yükümlülükleri yerine getirmek
          amacıyla, sözleşmenin kurulması, hukuki yükümlülük ve meşru menfaat hukuki
          sebeplerine dayanılarak işlenebilir.
        </p>
      </ContentSection>
      <ContentSection title="Haklarınız">
        <p>
          Kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme,
          düzeltme, silme veya anonimleştirme, işleme itiraz etme ve kanunda belirtilen
          diğer haklarınızı kullanma talebinizi yazılı olarak iletebilirsiniz.
        </p>
      </ContentSection>
      <ContentSection title="Başvuru">
        <p>
          Başvurunuzda kimliğinizi doğrulamaya yarayacak yeterli bilgi ile talebinizi
          açıkça belirtmeniz gerekir. Başvurular değerlendirilerek yasal süre içinde
          yanıtlanır.
        </p>
      </ContentSection>
    </PageShell>
  );
}

export function ServiceTermsPage() {
  return (
    <PageShell
      eyebrow="Ödeme ve hizmet"
      title="Koşullar"
      highlight="açık olsun."
      description="Ödeme talebi oluşturmadan önce hizmet kapsamını, tutarı ve tarafların sorumluluklarını inceleyin."
      meta={{
        title: "Ödeme ve Hizmet Koşulları | MMT Global",
        description: "MMT Global ödeme talepleri ve hizmet sunumu için genel koşullar.",
      }}
    >
      <ContentSection title="Ödeme talebi">
        <p>
          Ödeme formunda girilen tutar ve açıklama, talep edilen hizmet veya işlem için
          ön bilgi niteliğindedir. Hizmet kapsamı, fiyatı ve teslim koşulları gerektiğinde
          ayrıca yazılı olarak teyit edilir.
        </p>
      </ContentSection>
      <ContentSection title="Ödeme güvenliği">
        <p>
          Kart bilgileri MMT Global tarafından alınmaz veya saklanmaz. Ödeme işlemi,
          canlı kullanımda yetkili ödeme sağlayıcının güvenli ödeme sayfasında
          tamamlanır. Test ödeme modu gerçek tahsilat oluşturmaz.
        </p>
        <p>
          Tami üzerinden yapılan canlı işlemlerde ticari tahsilat TRY olarak
          gerçekleşir. Yabancı kart kullanımında kartı veren bankanın uyguladığı kur
          farkı veya işlem ücretleri müşteriye ait olabilir.
        </p>
      </ContentSection>
      <ContentSection title="İletişim">
        <p>
          Hizmet, fatura veya ödeme hakkında soru ve taleplerinizi ödeme öncesinde
          info@mmtglobal.com adresine iletin.
        </p>
        <ContactCta />
      </ContentSection>
    </PageShell>
  );
}

export function RefundPage() {
  return (
    <PageShell
      eyebrow="İade ve iptal"
      title="İşlemleriniz"
      highlight="güvence altında."
      description="İptal ve iade talepleri, ilgili hizmetin kapsamı ve taraflar arasındaki yazılı koşullar dikkate alınarak değerlendirilir."
      meta={{
        title: "İade ve İptal Koşulları | MMT Global",
        description: "MMT Global ödeme iptali, iade talepleri ve başvuru kanalları.",
      }}
    >
      <ContentSection title="Talep oluşturma">
        <p>
          İade veya iptal talebinizi işlem numarası, ödeme tarihi, tutar ve talep
          nedeninizle birlikte info@mmtglobal.com adresine gönderin. Kimlik ve işlem
          doğrulaması tamamlanmadan iade işlemi başlatılmaz.
        </p>
      </ContentSection>
      <ContentSection title="Değerlendirme">
        <p>
          Talep; hizmetin başlayıp başlamadığı, sözleşme veya teklif koşulları,
          uygulanabilir tüketici mevzuatı ve ödeme sağlayıcının işlem kuralları
          çerçevesinde incelenir. Onaylanan iadeler aynı ödeme kanalına yönlendirilir.
        </p>
      </ContentSection>
      <ContentSection title="Destek">
        <p>İşlem numaranızı paylaşarak destek ekibimizden durum bilgisi alabilirsiniz.</p>
        <ContactCta label="Ana sayfaya dön" />
      </ContentSection>
    </PageShell>
  );
}

export function InvestmentsPage() {
  return (
    <PageShell
      eyebrow="Yatırımlarımız"
      title="Uzun vadeli"
      highlight="değer."
      description="MMT Global, operasyonel yetkinlik, bölgesel büyüme ve sürdürülebilir iş ortaklıklarına odaklanır."
      meta={{
        title: "Yatırımlarımız | MMT Global",
        description: "MMT Global yatırım odağı, büyüme alanları ve iş ortaklığı yaklaşımı.",
      }}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <InfoCard icon={<Building2 />} title="Bölgesel gelişim">
          Lojistik, inşaat ve ticaret bağlantılarıyla bölgesel ekonomiye katkı sağlayan
          projeler ve iş birlikleri.
        </InfoCard>
        <InfoCard icon={<BriefcaseBusiness />} title="Operasyonel güç">
          Sağlık turizmi, finansal hizmetler ve kurumsal çözümlerde ölçülebilir,
          sorumlu ve uzun vadeli büyüme.
        </InfoCard>
      </div>
      <ContentSection title="İş ortaklığı yaklaşımımız">
        <p>
          Her yatırım ve ortaklık fırsatı; ticari uygunluk, risk, uyum, operasyonel
          kapasite ve sürdürülebilirlik kriterleriyle değerlendirilir. Yatırım
          görüşmeleri için şirketiniz, projeniz ve talebinizi özetleyen bir sunumu
          info@mmtglobal.com adresine gönderebilirsiniz.
        </p>
        <ContactCta label="İş ortaklığı için yazın" />
      </ContentSection>
    </PageShell>
  );
}

export function CareersPage() {
  return (
    <PageShell
      eyebrow="Kariyer"
      title="Birlikte"
      highlight="ilerleyelim."
      description="Farklı sektörleri ve pazarları birbirine bağlayan ekiplerde yer almak isteyen yeteneklerle tanışmak istiyoruz."
      meta={{
        title: "Kariyer | MMT Global",
        description: "MMT Global kariyer fırsatları ve açık pozisyon başvuru kanalı.",
      }}
    >
      <ContentSection title="Aradığımız yaklaşım">
        <p>
          Sorumluluk alan, farklı kültürlerle çalışabilen, işini veriye ve güvene
          dayandıran ekip arkadaşları arıyoruz. Lojistik, ticaret, finans, teknoloji,
          sağlık turizmi ve proje geliştirme deneyimleri değerlidir.
        </p>
      </ContentSection>
      <ContentSection title="Başvuru">
        <p>
          Özgeçmişinizi, ilgilendiğiniz alanı ve çalışmak istediğiniz rolü belirterek
          info@mmtglobal.com adresine gönderin. Uygun fırsat oluştuğunda sizinle
          iletişime geçeriz.
        </p>
        <a
          href="mailto:info@mmtglobal.com?subject=MMT%20Global%20Kariyer%20Başvurusu"
          className="mt-8 inline-flex items-center gap-2 bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-primary/90"
        >
          <Mail size={16} />
          Başvuru gönder
        </a>
      </ContentSection>
    </PageShell>
  );
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="border border-border/70 bg-card p-7">
      <div className="text-primary">{icon}</div>
      <h2 className="mt-6 text-2xl font-semibold">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-foreground/65">{children}</p>
    </article>
  );
}