# İzinli gerçek kayıt ve tek seferlik kurucu taslağı

Bu akış arka plan worker'ını açmaz. Yayın yapılandırmasındaki
`MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED=false` korunur.

1. Yetkili kurucu/operasyon hesabıyla `/staff/lojistik-havuzu` sayfasındaki
   **Sahadan topla** sekmesini açın.
2. Gerçek yükün çıkışını Mersin, varışını, yük/cins/miktar ve yükleme tarihini girin.
   İrtibat bilgilerini ancak MMT içinde kayıt ve eşleştirme izni varsa girin.
   Kaynağı, izin yöntemini ve teyit zamanını açıklamada belirtin.
   Sistemin kaydettiği aktör ve oluşturma zamanı bu açıklamaya eşlik eder.
3. **Boş araç** seçerek gerçek taşıyıcının kendi beyan ettiği konum, yön, açık
   birimli kapasite ve müsaitlik tarihini girin. Mersin desteklenir. Taşıyıcı
   `pending` kalır: havuzda aday olması belge doğrulaması, ticari kabul veya
   sevkiyat onayı değildir. Reddedilmiş aday uygun sayılmaz.
4. Kayıt sonrası iç havuz yenilenir. Gerekirse **İç kayıtları bir kez eşleştir**
   düğmesini kullanın. Bu işlem harici kaynak taraması veya Gemini çağrısı yapmaz.
   Sayfa açılışı ve görünümün GET yenilemesi havuz taraması başlatmaz.
5. Uygun yük-taşıyıcı eşleşmesini açıp kurucu olarak
   **Bir kez kurucu taslağı hazırla** düğmesine basın. Gemini yapılandırması
   mevcut değilse özellik kapalı kalır. Yalnız anonim operasyon bilgileri modele
   gider; bu açık tıklama model kullanımı doğurabilir.
6. Taslak `pending_review` / `founder_request` olarak mevcut tabloda saklanır ve
   yalnız kurucu görünümüne gelir. Aynı eşleşme/sürüm yeniden istendiğinde
   saklanan taslak kullanılır. Eşzamanlı manuel istekler veritabanı kilidiyle
   reddedilir. Kaynak/sürüm değişirse önceki taslak güncel kabul edilmez.

Tek seferlik taslak ucu Telegram kuyruğuna bile kayıt eklemez; dış bildirim,
ticari karar, ödeme ve gönderim başlatmaz. Eşleşme bulunamaması başarılı
eşleşme olarak gösterilmez; rota, tarih, kapasite ve izinleri kontrol edin.

Bu değişiklik yeni tablo veya alan gerektirmez. Üretime uygulanması için ayrı
Publish gerekir; geliştirme doğrulaması canlı kurucu oturumu doğrulaması değildir.
