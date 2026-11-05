import os
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# Uluslararası ve Yurtiçi Kritik Lojistik Merkezleri / Ülkeler / Gümrükler
LOCATIONS = [
    # Ülkeler
    "Türkiye", "Irak", "İran", "Gürcistan", "Azerbaycan", "Suriye", "Almanya", 
    "Hollanda", "Polonya", "Romanya", "Bulgaristan", "Rusya", "Ukrayna", "İtalya",
    # Bölgesel Merkezler & Gümrük Kapıları
    "Cizre", "Silopi", "Habur", "Zaho", "Erbil", "Duhok", "Süleymaniye", "Bağdat", "Basra",
    "Gürbulak", "Sarp", "Kapıkule", "Hamzabeyli", "Mersin", "İskenderun", "Mardin", 
    "Kızıltepe", "Gaziantep", "Şanlıurfa", "İstanbul", "Bursa", "İzmir", "Ankara"
]

def format_international_load_card(text: str, username: str) -> str:
    # Tonaj tespiti
    ton_match = re.search(r'(\d+[\.,]?\d*)\s*(ton|kg|t)', text, re.IGNORECASE)
    tonaj = ton_match.group(0) if ton_match else "Belirtilmedi"
    
    # Fiyat / Döviz tespiti (Dolar, Euro, TL, vb.)
    price_match = re.search(r'(\d+[\.,]?\d*)\s*(\$|€|usd|eur|tl|dolar|euro|dinar)', text, re.IGNORECASE)
    fiyat = price_match.group(0) if price_match else "Görüşülecek / Serbest Piyasa"

    # Güzergah eşleştirme
    found_locs = []
    for loc in LOCATIONS:
        if re.search(rf'\b{re.escape(loc)}\b', text, re.IGNORECASE):
            found_locs.append(loc)

    cikis = found_locs[0] if len(found_locs) > 0 else "Belirtilmedi"
    varis = found_locs[1] if len(found_locs) > 1 else "Belirtilmedi"

    return (
        f"🌐 *MMT GLOBAL — ULUSLARARASI YÜK İLANI*\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"📍 *Çıkış (Origin):* {cikis}\n"
        f"🏁 *Varış (Destination):* {varis}\n"
        f"⚖️ *Tonaj / Kapasite:* {tonaj}\n"
        f"💵 *Navlun / Bütçe:* {fiyat}\n"
        f"📝 *Yük Detayı:* {text}\n"
        f"👤 *Operatör / Firma:* @{username}\n"
        f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"🔒 *MMT Global Escrow & CMR Standartlarında*"
    )

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = update.effective_message
    if not msg or not msg.text or msg.text.startswith('/'):
        return

    text = msg.text
    user = msg.from_user.username or msg.from_user.first_name or "Operatör"

    # Yurtiçi ve Uluslararası Yük Anahtar Kelimeleri
    load_keywords = [
        "yük", "ton", "aranıyor", "tekstil", "gıda", "palet", "koli", "dorse",
        "tır", "tenteli", "frigo", "cmr", "navlun", "ihracat", "ithalat", "transit"
    ]
    is_load = any(k in text.lower() for k in load_keywords)

    if is_load:
        card = format_international_load_card(text, user)
        # Mesajın atıldığı konuya/gruba doğrudan kartı yanıt olarak fırlatır
        await msg.reply_text(
            text=card,
            parse_mode="Markdown"
        )

def start_background_web_server():
    port = int(os.getenv("PORT", "10000"))
    class DummyHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")
        def do_HEAD(self):
            self.send_response(200)
            self.end_headers()

    server = HTTPServer(('0.0.0.0', port), DummyHandler)
    server.serve_forever()

def main():
    if not TOKEN:
        print("HATA: TELEGRAM_BOT_TOKEN bulunamadi!")
        return

    threading.Thread(target=start_background_web_server, daemon=True).start()

    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_message))
    print("MMT Uluslararası Bot Aktif...")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
