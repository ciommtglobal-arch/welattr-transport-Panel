"""MMT Global VIP Telegram bot.

This is intentionally separate from the public logistics bot. It handles
Telegram Stars payments and grants a one-use invite link to the private VIP
channel after Telegram confirms the payment.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    LabeledPrice,
    Update,
)
from telegram.error import TelegramError
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    PreCheckoutQueryHandler,
    filters,
)


logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
)
logger = logging.getLogger("mmt-vip-bot")
for noisy_logger in ("httpx", "httpcore", "telegram.request"):
    logging.getLogger(noisy_logger).setLevel(logging.WARNING)


STARS_CALLBACK = "vip:stars"
WALLET_CALLBACK = "vip:wallet"
PAYLOAD_PREFIX = "mmt-vip-stars:"


def required_int(name: str) -> int:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is missing. Add it as a shared environment variable.")
    try:
        return int(value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc


@dataclass(frozen=True)
class Config:
    token: str
    channel_id: int
    price_stars: int
    access_days: int
    database_path: Path

    @classmethod
    def from_env(cls) -> "Config":
        token = os.getenv("TELEGRAM_VIP_BOT_TOKEN", "").strip()
        if not token:
            raise RuntimeError(
                "TELEGRAM_VIP_BOT_TOKEN is missing. Add it as a Replit Secret."
            )

        price_stars = int(os.getenv("VIP_PRICE_STARS", "250"))
        access_days = int(os.getenv("VIP_ACCESS_DAYS", "30"))
        if price_stars <= 0:
            raise RuntimeError("VIP_PRICE_STARS must be greater than zero")
        if access_days <= 0:
            raise RuntimeError("VIP_ACCESS_DAYS must be greater than zero")

        return cls(
            token=token,
            channel_id=required_int("TELEGRAM_VIP_CHANNEL_ID"),
            price_stars=price_stars,
            access_days=access_days,
            database_path=Path(
                os.getenv("VIP_DATABASE_PATH", "telegram-bot/vip_members.sqlite3")
            ),
        )


class MembershipStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS memberships (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    payload TEXT NOT NULL UNIQUE,
                    paid_at TEXT NOT NULL,
                    access_expires_at TEXT NOT NULL,
                    invite_link TEXT NOT NULL,
                    telegram_charge_id TEXT NOT NULL,
                    removed_at TEXT
                )
                """
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        return connection

    def add_membership(
        self,
        *,
        user_id: int,
        payload: str,
        paid_at: datetime,
        access_expires_at: datetime,
        invite_link: str,
        telegram_charge_id: str,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO memberships
                    (user_id, payload, paid_at, access_expires_at,
                     invite_link, telegram_charge_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    payload,
                    paid_at.isoformat(),
                    access_expires_at.isoformat(),
                    invite_link,
                    telegram_charge_id,
                ),
            )

    def expired_memberships(self, now: datetime) -> list[sqlite3.Row]:
        with self._connect() as connection:
            return list(
                connection.execute(
                    """
                    SELECT id, user_id
                    FROM memberships
                    WHERE removed_at IS NULL AND access_expires_at <= ?
                    """,
                    (now.isoformat(),),
                )
            )

    def mark_removed(self, membership_id: int, removed_at: datetime) -> None:
        with self._connect() as connection:
            connection.execute(
                "UPDATE memberships SET removed_at = ? WHERE id = ?",
                (removed_at.isoformat(), membership_id),
            )

    def report(self) -> tuple[int, list[sqlite3.Row]]:
        with self._connect() as connection:
            total = connection.execute(
                "SELECT COUNT(*) AS total FROM memberships"
            ).fetchone()["total"]
            rows = list(
                connection.execute(
                    """
                    SELECT user_id, paid_at, access_expires_at, removed_at
                    FROM memberships
                    ORDER BY paid_at DESC
                    LIMIT 20
                    """
                )
            )
        return int(total), rows


def payment_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "⭐ Telegram Stars ile öde",
                    callback_data=STARS_CALLBACK,
                )
            ],
            [
                InlineKeyboardButton(
                    "💳 Wallet Pay (yakında)",
                    callback_data=WALLET_CALLBACK,
                )
            ],
        ]
    )


def welcome_text(config: Config) -> str:
    return (
        "🔐 <b>MMT Global VIP Yük Hattı</b>\n\n"
        f"{config.access_days} günlük VIP kanal erişimi için ödeme yöntemini seçin.\n\n"
        f"⭐ Telegram Stars: <b>{config.price_stars} XTR</b>\n"
        "💳 Wallet Pay: merchant hesabı onaylanınca açılacak.\n\n"
        "Ödeme Telegram tarafından onaylandıktan sonra size tek kullanımlık "
        "kanal davet bağlantısı gönderilir."
    )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    config: Config = context.application.bot_data["config"]
    if update.message is None:
        return
    await update.message.reply_text(
        welcome_text(config),
        parse_mode="HTML",
        reply_markup=payment_keyboard(),
    )


async def vip_report(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    if update.effective_chat is None or update.effective_chat.type != "private":
        return
    if update.effective_user is None or update.message is None:
        return

    config: Config = context.application.bot_data["config"]
    store: MembershipStore = context.application.bot_data["store"]
    try:
        channel_member = await context.bot.get_chat_member(
            chat_id=config.channel_id,
            user_id=update.effective_user.id,
        )
    except TelegramError:
        await update.message.reply_text(
            "Rapor alınamadı. VIP kanal yöneticiliği doğrulanamadı."
        )
        return

    if channel_member.status not in {"creator", "administrator"}:
        await update.message.reply_text(
            "Bu komutu yalnızca VIP kanal yöneticileri kullanabilir."
        )
        return

    total, rows = store.report()
    lines = [
        "📊 <b>MMT Global VIP ödeme raporu</b>",
        f"Onaylanan ödeme: <b>{total}</b>",
        f"Toplam Stars: <b>{total * config.price_stars} XTR</b>",
        "",
        "<b>Son ödemeler:</b>",
    ]
    if not rows:
        lines.append("Henüz onaylanmış ödeme yok.")
    else:
        for row in rows:
            status = "aktif" if row["removed_at"] is None else "sona erdi"
            lines.append(
                f"• Kullanıcı ID: <code>{row['user_id']}</code> — "
                f"{row['paid_at'][:16].replace('T', ' ')} UTC — {status}"
            )
    await update.message.reply_text("\n".join(lines), parse_mode="HTML")


async def choose_payment(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    query = update.callback_query
    if query is None:
        return
    await query.answer()

    if query.data == WALLET_CALLBACK:
        await query.edit_message_text(
            "💳 Wallet Pay merchant hesabı henüz aktif değil. "
            "Şimdilik Telegram Stars ile ödeme kullanılabilir."
        )
        return

    config: Config = context.application.bot_data["config"]
    payload = f"{PAYLOAD_PREFIX}{uuid.uuid4().hex}"
    await context.bot.send_invoice(
        chat_id=query.from_user.id,
        title="MMT Global VIP",
        description=f"{config.access_days} günlük özel VIP kanal erişimi",
        payload=payload,
        provider_token="",
        currency="XTR",
        prices=[LabeledPrice(f"{config.access_days} günlük erişim", config.price_stars)],
        reply_markup=InlineKeyboardMarkup(
            [
                [
                    InlineKeyboardButton(
                        "Ödeme ekranını aç",
                        pay=True,
                    )
                ]
            ]
        ),
    )


async def pre_checkout(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    query = update.pre_checkout_query
    if query is None:
        return
    config: Config = context.application.bot_data["config"]
    valid = (
        query.invoice_payload.startswith(PAYLOAD_PREFIX)
        and query.currency == "XTR"
        and query.total_amount == config.price_stars
    )
    if valid:
        await query.answer(ok=True)
    else:
        await query.answer(
            ok=False,
            error_message="Ödeme bilgileri geçersiz. Lütfen işlemi yeniden başlatın.",
        )


async def successful_payment(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    message = update.message
    if message is None or message.successful_payment is None:
        return

    config: Config = context.application.bot_data["config"]
    store: MembershipStore = context.application.bot_data["store"]
    payment = message.successful_payment
    if (
        payment.currency != "XTR"
        or payment.total_amount != config.price_stars
        or not payment.invoice_payload.startswith(PAYLOAD_PREFIX)
    ):
        logger.warning("Rejected unexpected Stars payment payload")
        await message.reply_text(
            "Ödeme bilgileri doğrulanamadı. Lütfen destek hesabına yazın."
        )
        return

    paid_at = datetime.now(timezone.utc)
    expires_at = paid_at + timedelta(days=config.access_days)
    invite = await context.bot.create_chat_invite_link(
        chat_id=config.channel_id,
        name=f"VIP {message.from_user.id if message.from_user else 'member'}",
        expire_date=paid_at + timedelta(hours=24),
        member_limit=1,
    )
    store.add_membership(
        user_id=message.from_user.id if message.from_user else message.chat_id,
        payload=payment.invoice_payload,
        paid_at=paid_at,
        access_expires_at=expires_at,
        invite_link=invite.invite_link,
        telegram_charge_id=payment.telegram_payment_charge_id,
    )
    await message.reply_text(
        "✅ Ödemeniz Telegram tarafından onaylandı.\n\n"
        f"VIP erişiminiz {config.access_days} gün geçerlidir.\n"
        "Aşağıdaki bağlantı tek kullanımlıktır:",
        reply_markup=InlineKeyboardMarkup(
            [[InlineKeyboardButton("🔐 VIP kanala katıl", url=invite.invite_link)]]
        ),
    )
    logger.info("A Stars payment was confirmed and an invite was issued")


async def expire_memberships(context: ContextTypes.DEFAULT_TYPE) -> None:
    config: Config = context.application.bot_data["config"]
    store: MembershipStore = context.application.bot_data["store"]
    now = datetime.now(timezone.utc)
    for membership in store.expired_memberships(now):
        try:
            await context.bot.ban_chat_member(
                chat_id=config.channel_id,
                user_id=membership["user_id"],
                revoke_messages=False,
            )
            await context.bot.unban_chat_member(
                chat_id=config.channel_id,
                user_id=membership["user_id"],
                only_if_banned=True,
            )
        except TelegramError:
            logger.warning("Could not remove an expired VIP member")
        finally:
            store.mark_removed(membership["id"], now)


def main() -> None:
    config = Config.from_env()
    store = MembershipStore(config.database_path)
    application = (
        Application.builder()
        .token(config.token)
        .build()
    )
    application.bot_data["config"] = config
    application.bot_data["store"] = store
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("viprapor", vip_report))
    application.add_handler(CallbackQueryHandler(choose_payment, pattern=r"^vip:"))
    application.add_handler(PreCheckoutQueryHandler(pre_checkout))
    application.add_handler(
        MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment)
    )
    application.job_queue.run_repeating(
        expire_memberships,
        interval=900,
        first=900,
        name="expire-vip-memberships",
    )
    logger.info("MMT Global VIP bot is starting")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()