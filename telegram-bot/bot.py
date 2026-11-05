import os
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
GROUP_ID = int(os.getenv("TELEGRAM_GROUP_ID", "-1004481284132"))
LOAD_TOPIC_ID = int(os.getenv("TOPIC_LOAD_ID", "37"))

def format_load_card(text: str, username: str) -> str:
    ton_match = re.search(r'(\d+[\.,]?\d*)\s*(ton|kg)', text, re.IGNORECASE)
    tonaj = ton_match.group(0) if ton_match else "Belirtilmedi"
    
    cities = ["Bursa", "Mardin", "Karacabey", "Kızıltepe", "Adana", "Cizre", "Mersin", "İstanbul", "Erbil", "Zaho"]
    found = [c for c in cities if c.lower() in text.lower()]
    cikis = found[0] if len(found) > 0 else "Belirtilmedi"
    varis = found[1] if len(found) > 1 else "Belirtilmedi"

    return (
        f"📦 *YENİ YÜK İLANI*\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"📍 *Çıkış:* {cikis}\n"
        f"🏁 *Varış:* {varis}\n"
        f"⚖️ *Tonaj:* {tonaj}\n"
        f"📝 *Detay:* {text}\n"
        f"👤 *İlan Sahibi:* @{username}\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"🔒 *Güvenli Ödeme & Escrow Kapsamında*"
    )

async def handle_group_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = update.effective_message
    if not msg or not msg.text or msg.text.startswith('/'):
        return

    text = msg.text
    user = msg.from_user.username or msg.from_user.first_name or "Kullanıcı"

    load_keywords = ["yük", "ton", "aranıyor", "tekstil", "gıda", "palet", "koli", "dorse"]
    is_load = any(k in text.lower() for k in load_keywords)

    if is_load:
        card = format_load_card(text, user)
        await context.bot.send_message(
            chat_id=GROUP_ID,
            message_thread_id=LOAD_TOPIC_ID,
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
    app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_group_message))
    print("Otonom Bot Hazir ve Dinlemede...")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
