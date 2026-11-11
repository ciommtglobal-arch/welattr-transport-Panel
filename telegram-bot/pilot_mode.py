"""Private, allowlisted TEST pilot. No database access or group publication."""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Protocol

from telegram import Update
from telegram.error import TelegramError
from telegram.ext import Application, CommandHandler, ContextTypes

logger = logging.getLogger("mmt-telegram-pilot")
PILOT_REFERENCE = "UKR-MERSİN-NARENCİYE-001"


class PilotConfig(Protocol):
    token: str
    contact_admin_ids: frozenset[int]


async def pilot_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    user = update.effective_user
    message = update.effective_message
    allowed = context.bot_data.get("pilot_allowed_users", frozenset())
    if (
        chat is None or user is None or message is None
        or chat.type != "private" or chat.id != user.id
        or user.id not in allowed
    ):
        return
    await message.reply_text(
        "MMT GLOBAL — ÖZEL TEST PİLOTU\n\n"
        f"Dosya: {PILOT_REFERENCE}\n"
        "Bot: özel sohbet TEST modu açık.\n"
        "Gerçek müşteri / sevkiyat / sözleşme / ticari onay: oluşturulmaz.\n"
        "Grup yayını, moderasyon ve ödeme bildirimi: kapalı.\n\n"
        "Lojistik dosyası tamamlandı: BU KOMUT DOĞRULAMAZ.\n"
        "Dosyaya bağlı TEST daveti, görev teslimi, korunan çıktı "
        "revizyonları ve işlem geçmişi ayrı TEST çalışma alanındadır.\n"
        "Kalıcı TEST kaydı ve kullanıcı akışı bu komutla doğrulanmaz.\n\n"
        "Bu komut veritabanını okumaz veya değiştirmez. "
        "MMT Connect erişimi ve yetkileri mevcut Clerk oturumuyla "
        "kontrol edilmeye devam eder.\n"
        "Önizlemede /staff/test-lojistik çalışma alanını açın. "
        "Telegram komutu Clerk oturumu veya dosya yetkisi yerine geçmez."
    )


async def safe_error(_update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    # Provider error strings can contain token-bearing request URLs.
    logger.warning("Pilot command failed (%s).", type(context.error).__name__)


def build_pilot_application(config: PilotConfig) -> Application:
    if os.getenv("REPLIT_DEPLOYMENT") or os.getenv("NODE_ENV") == "production":
        raise RuntimeError("The TEST pilot must not run in production.")
    if not config.contact_admin_ids:
        raise RuntimeError("The private TEST pilot requires configured recipients.")
    application = Application.builder().token(config.token).build()
    application.bot_data["pilot_allowed_users"] = config.contact_admin_ids
    application.add_handler(CommandHandler(["start", "help", "pilot"], pilot_command))
    application.add_error_handler(safe_error)
    return application


async def run_pilot(config: PilotConfig) -> None:
    application = build_pilot_application(config)
    async with application:
        # run_polling()/Updater bootstrap can delete an existing webhook.
        # Use explicit get_updates instead, and refuse webhook conflicts.
        hook = await application.bot.get_webhook_info()
        if hook.url:
            raise RuntimeError("Existing webhook preserved; TEST polling not started.")
        if hook.pending_update_count:
            raise RuntimeError("Pending updates preserved; review required before TEST polling.")
        await application.start()
        logger.info(
            "Private TEST pilot started. Group publication and moderation disabled."
        )
        offset = None
        try:
            while True:
                try:
                    updates = await application.bot.get_updates(
                        offset=offset, timeout=25, allowed_updates=["message"],
                    )
                except TelegramError as exc:
                    logger.warning("TEST polling paused (%s).", type(exc).__name__)
                    await asyncio.sleep(10)
                    continue
                for update in updates:
                    await application.process_update(update)
                    offset = update.update_id + 1
        finally:
            await application.stop()
