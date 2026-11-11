"""Generate unsigned bank/POS request drafts without copying private evidence."""

from datetime import datetime
from html import escape
from pathlib import Path
from zoneinfo import ZoneInfo

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt
from docx.opc.constants import RELATIONSHIP_TYPE
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)


OUT = Path("deliverables/payment-preparation")
DATE = datetime.now(ZoneInfo("Europe/Istanbul")).strftime("%d.%m.%Y")
SOURCE_CHECKED_DATE = "03.10.2026"
COMPANY = (
    "MMT LOJİSTİK OTO KİRALAMA NAKLİYAT İNŞAAT PETROL ÜRÜNLERİ "
    "TURİZM İTHALAT İHRACAT SAN.VE TİC.LTD.ŞTİ."
)
DISCLAIMER = (
    "TASLAK / İMZASIZ — Genel hazırlık belgesidir; hukuki görüş, sözleşme, "
    "imza doğrulama raporu veya banka/POS onayı değildir. Eksik alanlar "
    "tamamlanmadan imzalanmamalıdır. Kurumun resmî formu önceliklidir."
)
SOURCES = [
    ("BTK — Elektronik imza genel bilgi",
     "https://www.btk.gov.tr/elektronik-imza-genel-bilgi"),
    ("BTK — Mobil imza dâhil sıkça sorulan sorular",
     "https://www.btk.tr/e-imza-ile-ilgili-sikca-sorulan-sorular"),
    ("Kamu SM — Nitelikli elektronik sertifika",
     "https://kamusm.bilgem.tubitak.gov.tr/urunler/nitelikli_elektronik_sertifika"),
    ("TCMB — Elektronik para kuruluşları / faaliyet izni kapsamları",
     "https://www.tcmb.gov.tr/wps/wcm/connect/tr/tcmb+tr/main+menu/"
     "temel+faaliyetler/odeme+hizmetleri/elektronik+para+kuruluslari"),
    ("iyzico — Sanal POS ürün ve başvuru bilgileri",
     "https://www.iyzico.com/isim-icin/sanal-pos"),
    ("PayTR — Başvuru ve gerekli belgeler",
     "https://www.paytr.com/blog/sanal-pos-nasil-alinir-gerekli-belgeler-nelerdir"),
    ("Sipay — Üye iş yeri başvurusu / işletmeye özel teklif",
     "https://sipay.com.tr/uye-is-yeri-basvuru"),
]


def p(text):
    return ("p", text)


def bullets(*items):
    return ("bullets", items)


def table(headers, *rows):
    return ("table", [headers, *rows])


SIGNATURE = [
    p("Yetkili temsilci: [AD SOYAD / GÖREV — güncel temsil yetkisine göre]"),
    p("Temsil dayanağı ve tek/müşterek imza gereği: [GÜNCEL BELGE REFERANSI]"),
    p("Tarih: [İMZA TARİHİ]   Kurum başvuru referansı: [İŞLEM SONRASI DOLDURULUR]"),
    p("İmza yöntemi (kurum kabul ederse): Mobil imza. Gerçek imza, kurumun "
      "kabul ettiği işlem üzerinden yetkili tarafından oluşturulur. "
      "Bu alanın metni tek başına bir imza değildir."),
]

BANK = [
    ("Banka hesap ve para birimi teyit talebi", [
        p(f"Ticaret unvanı (vergi levhası kopyasından aktarılmıştır): {COMPANY}"),
        p("Muhatap: [BANKANIN TİCARET UNVANI / ŞUBE VEYA KURUMSAL BİRİM]"),
        p("Konu: Şirket adına ticari hesap ve tahsilat kapsamının yazılı teyidi"),
        p("Şirketimizin kendi ticari faaliyetlerine ait fatura tahsilatları için "
          "hesap bilgilerinin ve aşağıdaki hususların bankanızın resmî kanalı "
          "üzerinden yazılı olarak teyidini talep ediyoruz:"),
        bullets(
            "Hesap sahibinin tam ticaret unvanı ve ilgili hesabın şirket adına "
            "aktif bir ticari hesap olup olmadığı.",
            "TRY, EUR ve USD için ayrı ayrı gelen ödeme kabulü, hesaba geçiş "
            "para birimi ve yurt içi/yurt dışı transfer kapsamı. Desteklenmeyen "
            "para birimleri ve yalnızca kur dönüşümü yapılan akışlar açıkça belirtilmelidir.",
            "İlgili para birimi bazında IBAN, banka BIC/SWIFT bilgisi ve "
            "varsa muhabir banka/gönderim talimatları. Bu bilgiler yalnızca "
            "bankanın güvenli kanalıyla iletilmelidir.",
            "Transfer/kur dönüşümü ücretleri, valör, limit, belge gereklilikleri "
            "ve varsa hesaba/işleme özgü kısıtlar.",
            "Bu talep ve hesap teyidi için mobil imza kabulü, kullanılacak "
            "resmî portal, belge formatı ve temsil yetkisi için gereken evrak.",
        ),
        p("Bu yazı hesap sahipliğine ilişkin kendi beyanımızın banka teyidi "
          "yerine geçtiği anlamına gelmez; hesap açma, kredi, teminat veya "
          "ödeme hizmeti yetkisi verildiğini de göstermez."),
        p("VKN, hesap ve kimlik bilgileri: İlgili banka tarafından istenen "
          "güvenli formda doldurulacaktır; bu genel taslağa eklenmemiştir."),
        p("Ekler: [BANKANIN GÜNCEL LİSTESİNE GÖRE TAMAMLANACAK]. Vergi "
          "levhası, sicil/faaliyet ve temsil belgeleri kurum talebine göre sunulacaktır."),
        *SIGNATURE,
    ]),
]

POS = [
    ("Sanal POS yazılı kabul ve teklif talebi", [
        p(f"Ticaret unvanı (vergi levhası kopyasından aktarılmıştır): {COMPANY}"),
        p("Muhatap: [SAĞLAYICININ / BANKANIN TAM TİCARET UNVANI]"),
        p("Konu: Şirket adına üye iş yeri değerlendirmesi ve yazılı teklif"),
        p("Şirketimizin kendi yasal ticari faaliyetlerinden doğan, şirketimiz "
          "adına düzenlenmiş faturalar için Sanal POS başvurusunu değerlendirmenizi "
          "ve kabul edilen faaliyet kapsamını yazılı olarak bildirmenizi talep ediyoruz."),
        p("Başvuru kapsamı taslağı: Kendi fatura tahsilatımızdır; üçüncü kişiler "
          "adına para toplama, mevduat, kredi, saklama/emanet hesap veya ödeme "
          "kuruluşu gibi faaliyet gösterme başvurusu değildir. Ücretsiz B2B "
          "ağının temel tanıtım ve eşleştirme hizmetleri için ödeme talep edilmez. "
          "Gerçek faaliyetler, ürün/hizmet ve faturalar başvuru öncesi doğru "
          "ve eksiksiz şekilde kurumun resmî formunda açıklanacaktır."),
        p("İncelenecek alanlar: [GERÇEK FAALİYETLER / ÜRÜN-HİZMETLER], "
          "[GERÇEK YAYIN ADRESİ], [AYLIK CİRO BEKLENTİSİ], "
          "[ORTALAMA/AZAMİ İŞLEM TUTARI], [HEDEF ÜLKELER]. "
          "Bu değerler henüz doğrulanmadığı için doldurulmamıştır."),
        bullets(
            "Üye iş yeri başvurusunun şirket unvanımıza ve faaliyetlerimize "
            "özel yazılı kabul/ret durumu; sözleşme tarafı ve ilgili faaliyet "
            "izninin hizmet kapsamı.",
            "3D Secure yöntemi/sürümü, zorunluluk/istisnalar, doğrulama başarısız "
            "olduğunda işlem davranışı; yerli/yabancı kredi ve banka kartları, "
            "kart ağları ve ülke kısıtları.",
            "Karttan çekim, banka hesabına aktarım ve iade para birimleri için "
            "TRY/EUR/USD'nin ayrı teyidi. Kur dönüşümü ile gerçek döviz "
            "tahsilat/aktarımının birbirinden açıkça ayrılması.",
            "Tek çekim/taksit/yabancı kart ücretleri; işlem başı/sabit/kur "
            "dönüşümü giderleri, vergi dâhil-hariç bilgisi ve teklif geçerlilik tarihi.",
            "Valör ve iş günü hesabı, aktarım sıklığı/asgari tutarı, bloke veya "
            "rezerv, limitler ve aktarım yapılacak şirket hesabı koşulları.",
        ),
        p("Devam: İade, KYC ve mobil imza koşulları sonraki sayfadadır."),
    ]),
    ("Sanal POS talebi — iade, KYC ve imza koşulları", [
        p(f"Başvuran şirket: {COMPANY}"),
        bullets(
            "Tam/kısmi iade, aynı gün iptal, iade süreleri, iade para birimi, "
            "iade edilen/edilmeyen komisyon ve işlem giderleri; ters ibraz "
            "süreci, süreleri ve ispat belgeleri.",
            "KYC/AML ve gerçek faydalanıcı incelemesi için güncel belge "
            "listesi, kabul edilen belge tarihi/formatı, güvenli yükleme "
            "kanalı ve tamamlanmış incelemenin yazılı sonucu.",
            "Üye iş yeri sözleşmesinin kurumunuzca sağlanan güncel örneği; "
            "kefalet/teminat, sorumluluk, fesih ve tek taraflı şart değişikliği "
            "hükümleri varsa açıkça gösterilmesi.",
            "Mobil imza kabul edilip edilmediği, desteklenen operatör/sertifika "
            "ve imza formatı, kullanılacak resmî işlem ekranı; tek/müşterek "
            "temsil şartlarının uygulanma yöntemi.",
            "Kart bilgilerinin MMT sunucusuna gönderilmediği hosted/yönlendirmeli "
            "ödeme modeli; sağlayıcı kaynaklı sonuç teyidi, imzalı bildirim, "
            "aynı işlemin iki kez tahsil edilmesini önleme, mutabakat ve iade "
            "entegrasyonu için resmî teknik belgeler.",
        ),
        p("Bu talep herhangi bir sağlayıcı teklifini kabul eden, sözleşmeyi "
          "imzalayan veya canlı tahsilatı açan bir beyan değildir. Sözleşme "
          "ve mali şartlar, yetkili şirket temsilcisi ile gerekli hukuk/mali "
          "danışman incelemesinden sonra ayrıca değerlendirilecektir."),
        p("VKN, banka/kimlik bilgileri ve erişim anahtarları bu taslağa "
          "eklenmemiştir. Belgeler yalnızca kurumun doğrulanmış güvenli "
          "kanalında sunulmalıdır; PIN, OTP veya özel anahtar paylaşılmaz."),
        p("Ekler: [KURUMUN GÜNCEL LİSTESİNE GÖRE TAMAMLANACAK]. "
          "Vergi levhası, sicil/faaliyet, temsil, gerçek faydalanıcı ve şirket "
          "hesabı belgeleri inceleme talebine göre sunulur."),
        *SIGNATURE,
    ]),
]

GUIDE = [
    ("Mobil imza başvuru hazırlığı — durum", [
        p(f"Dosya üretim tarihi: {DATE}. Belge durumu ve kamu kaynaklarının "
          f"son kontrol tarihi: {SOURCE_CHECKED_DATE}. Yeniden üretim yeni bir doğrulama değildir."),
        p(f"Taslak ticaret unvanı: {COMPANY}"),
        p("Unvan yüklenen vergi levhası kopyasından aktarılmıştır. Belgenin "
          "orijinalliği, güncelliği, mevcut sicille eşleşmesi ve kurum "
          "kabulü ayrıca kontrol edilmelidir. VKN/kimlik ve banka değerleri "
          "bu pakete kopyalanmamıştır."),
        table(
            ["Kontrol", "Son kontrolde kaydedilen durum"],
            ["Vergi levhası", "Kopya mevcut; kurumun güncel belge incelemesi bekleniyor."],
            ["Ticari hesap / IBAN / SWIFT", "Banka teyidi yok; doğrulanmadı."],
            ["TRY / EUR / USD tahsilat", "Şirket hesabı ve POS için ayrı ayrı doğrulanmadı."],
            ["Mobil imza", "Kullanıcı aktif olduğunu belirtti; sertifika, temsil ve kurum kabulü doğrulanmadı."],
            ["Üye iş yeri / KYC / sözleşme", "Yazılı sağlayıcı kabulü ve tamamlanmış inceleme yok."],
            ["Canlı tahsilat", "Kapalı; hazırlık belgesi ödeme yetkisi vermez."],
        ),
        p("Hazırlanan dosyalar: banka-teyit-talebi ve pos-kabul-teklif-talebi "
          "adlı PDF/DOCX taslakları. Bunlar gönderilmemiş ve imzalanmamıştır. "
          "Kurumların kendi formları veya portal adımları gerektiğinde bu "
          "talep yazıları yalnızca ön bilgi/ek belge işlevi görür."),
        p("İlk adım: Banka talep taslağındaki muhatap, tarih ve yetkili "
          "temsil alanlarını güncel sicil/temsil belgelerine göre doldurun; "
          "bankanın mobil imza kabul eden resmî kanalını teyit edin."),
    ]),
    ("Mobil imza öncesi ve sonrası kontrol sırası", [
        bullets(
            "1. İmza atılacak kurumun gerçek alan adını ve resmî başvuru "
            "kanalını doğrulayın. Mobil imza desteğini ve kurumun istediği "
            "belge/formatı sorun; her PDF veya her portal mobil imza kabul etmez.",
            "2. Unvan, muhatap, tarih, faaliyet/ciro ve yetkili alanlarını "
            "tamamlayın. Güncel imza sirküleri/sicile göre temsil yetkisi ve "
            "müşterek imza gereğini kontrol edin. Hat sahibi olmak tek başına "
            "şirketi temsile yetki vermez.",
            "3. Sertifikanın imza işlemindeki geçerliliği, güven zinciri ve "
            "iptal durumu kurumun/sağlayıcının doğrulama sistemiyle "
            "kontrol edilmelidir. Burada sertifika doğrulaması yapılmamıştır.",
            "4. Doldurulan başvuru nüshasını kurumun resmî formuna aktarın "
            "veya TASLAK/İMZASIZ hazırlık etiketlerini son nüshadan kaldırın. "
            "Metinle 'imzalı/onaylı' damgası eklemeyin. Son belgeyi yetkili "
            "gözden geçirip kabul edilen formatta oluşturmalıdır. PDF için PAdES, ayrı imza dosyası için "
            "CAdES veya kurumun başka formatı gerekebilir; formatı kurum belirler.",
            "5. İmza yalnızca desteklenen resmî işlemde başlatılır. Belgeyi "
            "ve işlem açıklamasını kontrol ettikten sonra telefondaki mobil "
            "imza onayını yetkili kişi verir. PIN/OTP/özel anahtar Agent'a, "
            "çalışanlara veya sohbet/mesajlaşma kanallarına iletilmez.",
            "6. İmzalı dosyayı ve varsa ayrı imza dosyasını, doğrulama "
            "sonucunu ve kurum alındısını özel arşive kaydedin. Kurumun "
            "istediği zaman damgası/uzun dönem doğrulama şartlarını tamamlayın. "
            "İmza sonrası dosyayı yeniden dışa aktarmayın veya değiştirmeyin.",
            "7. Banka/sağlayıcıdan şirket adına yazılı kabulü ayrıca alın. "
            "Başvuru alındısı, imzalı talep veya vergi levhası kabul/onay "
            "yerine geçmez. KYC ve sözleşme sonucu da ayrı teyit edilir.",
        ),
        p("İsim yazmak, kaşe/ıslak imza fotoğrafı koymak, 'CİO onaylı' veya "
          "'e-imzalı' metni eklemek güvenli elektronik imza oluşturmaz. "
          "Mali mühür de kurumun istediği temsilci mobil imzası yerine "
          "kendiliğinden kullanılmamalıdır."),
        p("Bu paket imza uygulaması değildir; SIM'e/sertifikaya erişmez, "
          "imza işlemi başlatmaz ve mobil imza hizmet sağlayıcısı bağlantısı içermez."),
    ]),
    ("KYC/AML belge ve güvenli teslim kontrolü", [
        p("Aşağıdaki liste hazırlık amaçlıdır. Kesin belge listesi, "
          "güncellik süreleri ve kabul formatı kurumdan alınmalıdır."),
        table(
            ["Belge / kontrol", "Durum / işlem"],
            ["Vergi levhası", "Kopya mevcut; güncellik ve kurum kabulü teyit edilecek."],
            ["Ticaret sicili / ana sözleşme", "Güncel kayıt ve değişiklikler temin edilecek."],
            ["Faaliyet belgesi", "Kurumun kabul ettiği tarihteki belge temin edilecek."],
            ["İmza sirküleri / temsil yetkisi", "Tek veya müşterek yetki ve imzalayacak kişiler doğrulanacak."],
            ["Gerçek faydalanıcı / kimlik", "Yalnızca kurum istiyorsa kendi güvenli kanalında sunulacak."],
            ["Şirket hesabı teyidi", "Unvan, para birimi, IBAN/SWIFT ve hesap kapsamı bankadan alınacak."],
            ["Faaliyet / fatura / internet sitesi", "Gerçek ürün-hizmet, hedef ülkeler, işlem/ciro bilgileri açıklanacak."],
            ["İade / iptal / teslim koşulları", "Gerçek faaliyetlere uygun koşullar kurum talebine göre sunulacak."],
            ["KYC/AML inceleme sonucu", "Kurumun tamamlanmış incelemesi ve kabulü alınacak."],
            ["Üye iş yeri sözleşmesi", "Resmî kurum belgesi incelenecek; yetkili imzası ve kurum kabulü alınacak."],
        ),
        p("Tam ekstre, bakiye veya ilgisiz noter/çek belgelerini bu hazırlık "
          "paketine eklemeyin. Gerekli banka ve kimlik verilerini kaynak "
          "koda, istemciye, herkese açık sayfalara veya Telegram/WhatsApp "
          "koordinasyon mesajlarına koymayın. Orijinal gerekli veriler "
          "yalnızca yetkili kurumun güvenli başvuru kanalında sunulur."),
        p("Kişisel kefalet/teminat, sınırsız sorumluluk veya belirsiz bloke "
          "hükümleri varsa imzadan önce uzman hukuk ve mali danışman "
          "incelemesi alın. Bu paket kurum sözleşmesini üretmez veya onaylamaz."),
    ]),
    ("Sağlayıcı karşılaştırma — henüz teklif yok", [
        p("TCMB'nin erişim tarihinde faaliyette bulunan elektronik para "
          "kuruluşları tablosunda İyzi (864), Paytr (863) ve Sipay (838) "
          "listeleniyor. Bu kamu kaydı MMT'nin kabul edildiğini göstermez. "
          "İlgili hizmet izni kapsamı ve güncel durum başvuru tarihinde "
          "yeniden kontrol edilmelidir. Banka POS için banka seçilmedi."),
        p("Pazarlama sayfalarındaki hız, oran veya döviz desteği MMT'ye "
          "özel sözleşme şartı değildir. Aşağıdaki ticari kıyaslama "
          "tamamlanmış değildir; yalnızca yazılı tekliflerle doldurulur."),
        table(
            ["Yazılı teyit / koşul", "iyzico", "PayTR", "Sipay", "Banka POS"],
            ["Şirket / faaliyet kabulü", "Yok", "Yok", "Yok", "Seçilmedi"],
            ["3D Secure zorunluluğu / sürümü", "Bekliyor", "Bekliyor", "Bekliyor", "Bekliyor"],
            ["Yerli / yabancı kart ve ülke", "Bekliyor", "Bekliyor", "Bekliyor", "Bekliyor"],
            ["TRY / EUR / USD kart çekimi", "Bekliyor", "Bekliyor", "Bekliyor", "Bekliyor"],
            ["Hesaba aktarım / iade para birimi", "Bekliyor", "Bekliyor", "Bekliyor", "Bekliyor"],
            ["Kur dönüşümü / ek ücret", "Bekliyor", "Bekliyor", "Bekliyor", "Bekliyor"],
            ["Komisyon / sabit gider / vergi", "Bekliyor", "Bekliyor", "Bekliyor", "Bekliyor"],
            ["Valör / bloke / rezerv / limit", "Bekliyor", "Bekliyor", "Bekliyor", "Bekliyor"],
            ["Tam / kısmi iade ve ücretler", "Bekliyor", "Bekliyor", "Bekliyor", "Bekliyor"],
            ["İptal / ters ibraz şartları", "Bekliyor", "Bekliyor", "Bekliyor", "Bekliyor"],
            ["Mobil imza / sözleşme / KYC", "Bekliyor", "Bekliyor", "Bekliyor", "Bekliyor"],
            ["Teklif tarihi / geçerlilik", "Bekliyor", "Bekliyor", "Bekliyor", "Bekliyor"],
        ),
        p("Seçim koşulu: Şirketi yazılı kabul eden, ilgili hizmete yetkili "
          "kurum ve ihtiyaca uygun banka/para birimi kapsamı. EUR/USD "
          "yalnızca TRY'ye çevriliyorsa gerçek döviz aktarımı olarak "
          "kaydedilmez. Desteklenmeyen para biriminde tahsilat açılmaz."),
    ]),
    ("Kabul kayıtları, açılış sınırı ve kaynaklar", [
        table(
            ["Kayıt", "Doldurulacak alanlar"],
            ["Banka teyidi", "Kurum / belge tarihi / güvenli arşiv referansı / inceleyen yetkili"],
            ["Mobil imza sonucu", "İmzalı dosya / doğrulama raporu / kurum alındısı / imza tarihi"],
            ["POS yazılı kabulü", "Kurum / şirket unvanı / kabul edilen faaliyet / kapsam / tarih"],
            ["Teklif ve sözleşme", "Teklif-sözleşme sürümü / şartların onayı / KYC sonucu / kurum kabulü"],
        ),
        p("Bu kayıtlar boş/beklemede bırakılmıştır; gerçek belgeler "
          "oluşmadan 'doğrulandı', 'imzalandı' veya 'onaylandı' yazılmamalıdır."),
        p("Canlı açılış için banka ve sağlayıcı teyidine ek olarak güvenli "
          "hosted ödeme, sağlayıcı sonuç teyidi, bildirim doğrulaması, "
          "tekrar tahsilat önleme, mutabakat ve iade akışı tamamlanmalı; "
          "şirket sahibinin açık canlı açılış onayı alınmalıdır. Mevcut "
          "ödeme sistemi bu hazırlık paketiyle açılmaz."),
        p(f"Resmî bilgi kaynakları — erişim/kontrol: {SOURCE_CHECKED_DATE}. Kaynaklar genel "
          "bilgi ve kamu lisans kaydı içindir; şirkete özel kabul değildir."),
        ("links", SOURCES),
        p("Not: Mobil imzanın hukuki niteliği hakkında genel bilgi BTK "
          "ve Kamu SM kaynaklarına dayanır; somut işlemin kabulü, "
          "istisnalar ve sözleşme şartları için kurum ve yetkili hukuk "
          "danışmanının değerlendirmesi gerekir."),
    ]),
]


def add_docx_link(paragraph, label, url):
    link = OxmlElement("w:hyperlink")
    rel = paragraph.part.relate_to(url, RELATIONSHIP_TYPE.HYPERLINK, is_external=True)
    link.set(qn("r:id"), rel)
    run = OxmlElement("w:r")
    props = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "174B6E")
    props.append(color)
    run.append(props)
    text = OxmlElement("w:t")
    text.text = label
    run.append(text)
    link.append(run)
    paragraph._p.append(link)


def save_docx(stem, pages):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.top_margin = sec.bottom_margin = Cm(1.7)
    sec.left_margin = sec.right_margin = Cm(1.8)
    style = doc.styles["Normal"]
    style.font.name, style.font.size = "Calibri", Pt(10)
    style.paragraph_format.space_after = Pt(5)
    doc.core_properties.title = pages[0][0]
    doc.core_properties.author = "MMT Global — imzasız hazırlık taslağı"
    sec.footer.paragraphs[0].text = "MMT Global | TASLAK · İMZASIZ · KURUM ONAYI DEĞİL"
    sec.footer.paragraphs[0].style = doc.styles["Caption"]
    for i, (heading, blocks) in enumerate(pages):
        if i:
            doc.add_page_break()
        doc.add_heading(heading, 0 if i == 0 else 1)
        doc.add_paragraph(DISCLAIMER, style="Caption")
        for kind, value in blocks:
            if kind == "p":
                doc.add_paragraph(value)
            elif kind == "bullets":
                for item in value:
                    doc.add_paragraph(item, style="List Bullet")
            elif kind == "links":
                for label, url in value:
                    add_docx_link(doc.add_paragraph(), label, url)
            else:
                t = doc.add_table(rows=0, cols=len(value[0]))
                t.style = "Light Shading Accent 1"
                for row in value:
                    cells = t.add_row().cells
                    for cell, text in zip(cells, row):
                        cell.text = text
                doc.add_paragraph()
    doc.save(OUT / f"{stem}.docx")


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("TR", 8)
    canvas.setFillColor(colors.HexColor("#65707b"))
    canvas.drawString(18 * mm, 12 * mm, "MMT Global | TASLAK · İMZASIZ · KURUM ONAYI DEĞİL")
    canvas.drawRightString(192 * mm, 12 * mm, str(doc.page))
    canvas.restoreState()


def save_pdf(stem, pages):
    body = ParagraphStyle("Body", fontName="TR", fontSize=9.2, leading=13,
                          spaceAfter=6, alignment=TA_LEFT)
    heading = ParagraphStyle("Heading", fontName="TR-Bold", fontSize=17,
                             leading=22, spaceAfter=10, textColor=colors.HexColor("#174B6E"))
    small = ParagraphStyle("Small", parent=body, fontSize=8, leading=11,
                           textColor=colors.HexColor("#765129"), spaceAfter=9)
    cell = ParagraphStyle("Cell", parent=body, fontSize=8.1, leading=11, spaceAfter=0)
    story = []
    for i, (title, blocks) in enumerate(pages):
        if i:
            story.append(PageBreak())
        story += [Paragraph(escape(title), heading), Paragraph(escape(DISCLAIMER), small)]
        for kind, value in blocks:
            if kind == "p":
                story.append(Paragraph(escape(value), body))
            elif kind == "bullets":
                for item in value:
                    story.append(Paragraph("• " + escape(item), body))
            elif kind == "links":
                for label, url in value:
                    story.append(Paragraph(f'<link href="{escape(url, quote=True)}">'
                                           f'{escape(label)}</link>', body))
            else:
                rows = [[Paragraph(escape(text), cell) for text in row] for row in value]
                width = 174 * mm
                widths = ([width * .34, width * .66] if len(value[0]) == 2
                          else [width * .42, *([width * .145] * 4)])
                t = Table(rows, colWidths=widths, repeatRows=1, hAlign="LEFT")
                t.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E7EDF3")),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F9FB")]),
                    ("GRID", (0, 0), (-1, -1), .4, colors.HexColor("#CBD5DF")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]))
                story += [t, Spacer(1, 8)]
    pdf = SimpleDocTemplate(str(OUT / f"{stem}.pdf"), pagesize=(210 * mm, 297 * mm),
                            leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=17 * mm, bottomMargin=22 * mm,
                            title=pages[0][0], author="MMT Global — imzasız hazırlık taslağı")
    pdf.build(story, onFirstPage=footer, onLaterPages=footer)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    font_dir = Path("/usr/share/fonts/truetype/dejavu")
    pdfmetrics.registerFont(TTFont("TR", str(font_dir / "DejaVuSans.ttf")))
    pdfmetrics.registerFont(TTFont("TR-Bold", str(font_dir / "DejaVuSans-Bold.ttf")))
    for stem, pages in [
        ("mmt-mobil-imza-hazirlik", GUIDE),
        ("banka-teyit-talebi", BANK),
        ("pos-kabul-teklif-talebi", POS),
    ]:
        save_docx(stem, pages)
        save_pdf(stem, pages)
        print(f"Generated {stem}.pdf and {stem}.docx")


if __name__ == "__main__":
    main()