"""MMT Global Telegram logistics bot.

The bot uses polling so it can run as a simple Replit background workflow.
It deliberately keeps operational configuration in environment variables and
does not store Telegram tokens or user data in the repository.
"""

from __future__ import annotations

import logging
import os
import re
import unicodedata
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Final

from telegram import (
    ChatPermissions,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Update,
)
from telegram.constants import ChatMemberStatus
from telegram.error import TelegramError
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)


logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
)
logger = logging.getLogger("mmt-telegram-bot")


ORIGIN, DESTINATION, TONNAGE, BODY_TYPE, CONTACT = range(5)
LISTING_LOAD: Final = "load"
LISTING_VEHICLE: Final = "vehicle"
CALLBACK_LOAD: Final = "listing:load"
CALLBACK_VEHICLE: Final = "listing:vehicle"
CALLBACK_CANCEL: Final = "listing:cancel"

URL_RE = re.compile(
    r"(?i)(?:(?:https?://|www\.|t\.me/|telegram\.me/)[^\s<>]+)"
)
LABELS = {
    "cikis": ("çıkış", "cikis"),
    "varis": ("varış", "varis"),
    "tonaj": ("tonaj",),
    "kasa": ("kasa tipi", "kasa"),
    "iletisim": ("iletişim", "iletisim", "telefon", "tel"),
}


def env_int(name: str) -> int | None:
    value = os.getenv(name, "").strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc


def env_int_list(name: str) -> frozenset[int]:
    value = os.getenv(name, "")
    values: set[int] = set()
    for item in value.split(","):
        item = item.strip()
        if item:
            try:
                values.add(int(item))
            except ValueError as exc:
                raise RuntimeError(f"{name} contains a non-integer value") from exc
    return frozenset(values)


def normalize_text(value: str) -> str:
    """Make Turkish text checks tolerant of case and accents."""
    lowered = value.lower().replace("ı", "i")
    return "".join(
        char
        for char in unicodedata.normalize("NFKD", lowered)
        if not unicodedata.combining(char)
    )


def clean_username(value: str) -> str:
    return value.strip().removeprefix("@").removeprefix("https://t.me/").strip("/")


@dataclass(frozen=True)
class Config:
    token: str
    group_id: int | None
    public_username: str
    loads_topic_id: int | None
    vehicles_topic_id: int | None
    moderator_ids: frozenset[int]
    allowed_domains: tuple[str, ...]
    ban_after_strikes: int

    @classmethod
    def from_env(cls) -> "Config":
        token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
        if not token:
            raise RuntimeError(
                "TELEGRAM_BOT_TOKEN is missing. Add it as a Replit Secret."
            )

        domains = tuple(
            domain.strip().lower().removeprefix("www.")
            for domain in os.getenv(
                "ALLOWED_LINK_DOMAINS",
                "t.me,mmtglobal.com.tr,mmt-global-website-1.replit.app",
            ).split(",")
            if domain.strip()
        )
        return cls(
            token=token,
            group_id=env_int("TELEGRAM_GROUP_ID"),
            public_username=clean_username(
                os.getenv("TELEGRAM_PUBLIC_USERNAME", "")
            ),
            loads_topic_id=env_int("LOADS_TOPIC_ID"),
            vehicles_topic_id=env_int("EMPTY_VEHICLES_TOPIC_ID"),
            moderator_ids=env_int_list("TELEGRAM_MODERATOR_IDS"),
            allowed_domains=domains,
            ban_after_strikes=max(1, env_int("BAN_AFTER_STRIKES") or 3),
        )


def menu() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "📦 Yük ilanı oluştur", callback_data=CALLBACK_LOAD
                ),
                InlineKeyboardButton(
                    "🚚 Boş araç ilanı oluştur", callback_data=CALLBACK_VEHICLE
                ),
            ],
            [InlineKeyboardButton("İptal", callback_data=CALLBACK_CANCEL)],
        ]
    )


def topic_link(config: Config, chat_id: int, topic_id: int | None) -> str | None:
    if topic_id is None:
        return None
    if config.public_username:
        return f"https://t.me/{config.public_username}/{topic_id}"
    raw_chat_id = str(chat_id)
    internal_id = raw_chat_id[4:] if raw_chat_id.startswith("-100") else raw_chat_id
    return f"https://t.me/c/{internal_id}/{topic_id}"


def has_label(text: str, aliases: tuple[str, ...]) -> bool:
    normalized = normalize_text(text)
    return any(
        re.search(rf"(?m)^\s*{re.escape(normalize_text(alias))}\s*:", normalized)
        for alias in aliases
    )


def is_formatted_listing(text: str) -> bool:
    return all(has_label(text, aliases) for aliases in LABELS.values())


def is_allowed_url(url: str, config: Config) -> bool:
    host_match = re.search(r"(?i)(?:https?://|www\.)([^/\s?#]+)", url)
    if not host_match:
        host_match = re.match(r"(?i)(?:t\.me/|telegram\.me/)", url)
    if not host_match:
        return False
    host = (
        "t.me"
        if re.match(r"(?i)(?:t\.me/|telegram\.me/)", url)
        else host_match.group(1).lower().removeprefix("www.")
    )
    return any(host == domain or host.endswith(f".{domain}") for domain in config.allowed_domains)


def find_unapproved_url(text: str, config: Config) -> str | None:
    for url in URL_RE.findall(text):
        if not is_allowed_url(url, config):
            return url
    return None


PROFANE_TERMS: Final = (
    "amk",
    "aq",
    "orospu",
    "sikik",
    "siktir",
    "yarrak",
    "piç",
    "pic",
    "gerizekalı",
    "gerizekali",
)


def contains_profanity(text: str) -> bool:
    normalized = normalize_text(text)
    return any(re.search(rf"(?<![a-z]){re.escape(term)}(?![a-z])", normalized) for term in PROFANE_TERMS)


def is_target_group(update: Update, config: Config) -> bool:
    chat = update.effective_chat
    return bool(chat and chat.type in {"group", "supergroup"} and
                (config.group_id is None or chat.id == config.group_id))


async def sender_is_admin(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> bool:
    user = update.effective_user
    chat = update.effective_chat
    if not user or not chat:
        return False
    if user.id in context.bot_data["config"].moderator_ids:
        return True
    try:
        member = await context.bot.get_chat_member(chat.id, user.id)
    except TelegramError:
        return False
    return member.status in {ChatMemberStatus.ADMINISTRATOR, ChatMemberStatus.OWNER}


async def delete_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    if not message:
        return
    try:
        await message.delete()
    except TelegramError as exc:
        logger.warning("Could not delete message %s: %s", message.message_id, exc)


async def issue_strike(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    reason: str,
    *,
    ban_immediately: bool = False,
) -> None:
    message = update.effective_message
    user = update.effective_user
    chat = update.effective_chat
    config: Config = context.bot_data["config"]
    if not message or not user or not chat:
        return

    await delete_message(update, context)
    strikes: defaultdict[tuple[int, int], int] = context.bot_data["strikes"]
    key = (chat.id, user.id)
    strikes[key] += 1
    should_ban = ban_immediately or strikes[key] >= config.ban_after_strikes

    if should_ban:
        try:
            await context.bot.ban_chat_member(
                chat.id, user.id, revoke_messages=True
            )
            logger.info("Banned user %s from %s (%s)", user.id, chat.id, reason)
            return
        except TelegramError as exc:
            logger.warning("Could not ban user %s: %s", user.id, exc)

    try:
        await context.bot.send_message(
            chat_id=chat.id,
            message_thread_id=message.message_thread_id,
            text=(
                f"@{user.username or user.first_name}, mesajınız kaldırıldı: {reason}.\n"
                f"Uyarı: {strikes[key]}/{config.ban_after_strikes}. "
                "Lütfen grup kurallarına uyun."
            ),
        )
    except TelegramError as exc:
        logger.warning("Could not send moderation notice: %s", exc)


async def moderate_and_validate(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    message = update.effective_message
    user = update.effective_user
    config: Config = context.bot_data["config"]
    if not message or not user or not is_target_group(update, config):
        return
    if await sender_is_admin(update, context):
        return

    if user.is_bot:
        await issue_strike(
            update, context, "bot hesaplarına izin verilmemektedir", ban_immediately=True
        )
        return

    text = message.text or message.caption or ""
    unapproved_url = find_unapproved_url(text, config)
    if unapproved_url:
        await issue_strike(update, context, "izinsiz reklam veya dış bağlantı")
        return
    if contains_profanity(text):
        await issue_strike(update, context, "hakaret/küfür içeren içerik")
        return

    thread_id = message.message_thread_id
    tracked_topics = {
        topic_id
        for topic_id in (config.loads_topic_id, config.vehicles_topic_id)
        if topic_id is not None
    }
    active_users: set[int] = context.chat_data.setdefault("active_listing_users", set())
    if thread_id not in tracked_topics or user.id in active_users:
        return

    if not is_formatted_listing(text):
        try:
            await context.bot.send_message(
                chat_id=message.chat.id,
                message_thread_id=thread_id,
                text=(
                    "İlanınızda eksik alan var. Lütfen ilanı şu alanlarla paylaşın:\n"
                    "Çıkış · Varış · Tonaj · Kasa Tipi · İletişim\n\n"
                    "İsterseniz aşağıdaki menüden formatlı ilan oluşturabilirsiniz."
                ),
                reply_markup=menu(),
            )
        except TelegramError as exc:
            logger.warning("Could not send listing format notice: %s", exc)


async def id_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    message = update.effective_message
    if not chat or not message:
        return
    thread_id = message.message_thread_id
    await message.reply_text(
        "Kimlik bilgileri:\n"
        f"TELEGRAM_GROUP_ID={chat.id}\n"
        f"message_thread_id={thread_id}\n\n"
        "Bu mesajı yük veya araç topic'inde gönderirseniz ilgili topic ID'sini alırsınız."
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    if message:
        await message.reply_text(
            "MMT Global Lojistik Bot komutları:\n"
            "/id — grup ve topic ID'sini gösterir\n"
            "/load — yük ilanı oluşturur\n"
            "/vehicle — boş araç ilanı oluşturur\n"
            "/links — genel/davet/topic bağlantılarını gösterir (yönetici)\n"
            "/cancel — aktif ilan formunu iptal eder"
        )


async def links_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.effective_message
    config: Config = context.bot_data["config"]
    if not message or not is_target_group(update, config):
        return
    if not await sender_is_admin(update, context):
        await message.reply_text("Bu komut yalnızca grup yöneticileri içindir.")
        return

    lines: list[str] = []
    if config.public_username:
        lines.append(f"Genel grup: https://t.me/{config.public_username}")
    else:
        lines.append(
            "Genel grup kullanıcı adı ayarlı değil. Telegram uygulamasında "
            "Grup Bilgisi > Düzenle > Grup Türü > Genel Grup adımından ayarlayın."
        )
    try:
        invite = await context.bot.create_chat_invite_link(
            chat_id=message.chat.id,
            name="MMT Global operasyon daveti",
        )
        lines.append(f"Kalıcı davet: {invite.invite_link}")
    except TelegramError as exc:
        lines.append(
            "Davet linki üretilemedi. Botun davet bağlantısı oluşturma yetkisini "
            "kontrol edin."
        )
        logger.warning("Could not create invite link: %s", exc)

    for label, topic_id in (
        ("Yük İlanları", config.loads_topic_id),
        ("Boş Araçlar", config.vehicles_topic_id),
    ):
        link = topic_link(config, message.chat.id, topic_id)
        if link:
            lines.append(f"{label}: {link}")
        else:
            lines.append(f"{label}: topic ID henüz ayarlanmadı.")

    await message.reply_text(
        "\n".join(lines)
        + "\n\nNot: Bot API bir grubu public yapamaz ve davet linkini "
        "belirli bir topic'e kilitleyemez. Public kullanıcı adı Telegram "
        "uygulamasından ayarlanır; topic linki üyelikten sonra açılır."
    )


async def start_listing(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    listing_type: str,
) -> int:
    message = update.effective_message
    chat = update.effective_chat
    config: Config = context.bot_data["config"]
    if not message or not chat or not is_target_group(update, config):
        return ConversationHandler.END

    target_topic = (
        config.loads_topic_id
        if listing_type == LISTING_LOAD
        else config.vehicles_topic_id
    )
    if target_topic is None:
        await message.reply_text(
            "Bu ilan türünün topic ID'si henüz ayarlanmadı. "
            "Yönetici LOADS_TOPIC_ID veya EMPTY_VEHICLES_TOPIC_ID değerini eklemeli."
        )
        return ConversationHandler.END

    context.user_data["listing_type"] = listing_type
    context.user_data["source_chat_id"] = chat.id
    context.user_data["source_thread_id"] = message.message_thread_id
    active_users: set[int] = context.chat_data.setdefault("active_listing_users", set())
    if update.effective_user:
        active_users.add(update.effective_user.id)

    title = "YÜK" if listing_type == LISTING_LOAD else "BOŞ ARAÇ"
    await message.reply_text(
        f"{title} ilanı oluşturuluyor.\n\n1/5 — Çıkış noktası nedir?"
    )
    return ORIGIN


async def begin_from_button(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    query = update.callback_query
    await query.answer()
    listing_type = (
        LISTING_LOAD if query.data == CALLBACK_LOAD else LISTING_VEHICLE
    )
    return await start_listing(update, context, listing_type)


async def begin_load(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    return await start_listing(update, context, LISTING_LOAD)


async def begin_vehicle(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    return await start_listing(update, context, LISTING_VEHICLE)


async def cancel_listing(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    if update.callback_query:
        await update.callback_query.answer()
    chat = update.effective_chat
    user = update.effective_user
    if chat and user:
        active_users: set[int] = context.chat_data.setdefault("active_listing_users", set())
        active_users.discard(user.id)
    context.user_data.clear()
    message = update.effective_message
    if message:
        await message.reply_text("İlan formu iptal edildi.")
    return ConversationHandler.END


async def collect_origin(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    context.user_data["origin"] = (update.effective_message.text or "").strip()
    await update.effective_message.reply_text("2/5 — Varış noktası nedir?")
    return DESTINATION


async def collect_destination(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    context.user_data["destination"] = (update.effective_message.text or "").strip()
    await update.effective_message.reply_text("3/5 — Tonaj nedir? Örnek: 24 ton")
    return TONNAGE


async def collect_tonnage(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    context.user_data["tonnage"] = (update.effective_message.text or "").strip()
    await update.effective_message.reply_text(
        "4/5 — Kasa tipi nedir? Örnek: tenteli, açık kasa, lowbed"
    )
    return BODY_TYPE


async def collect_body_type(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    context.user_data["body_type"] = (update.effective_message.text or "").strip()
    await update.effective_message.reply_text(
        "5/5 — İletişim bilgisini yazın. Telefon veya Telegram kullanıcı adı olabilir."
    )
    return CONTACT


async def collect_contact(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> int:
    message = update.effective_message
    chat = update.effective_chat
    user = update.effective_user
    config: Config = context.bot_data["config"]
    if not message or not chat or not user:
        return ConversationHandler.END

    context.user_data["contact"] = (message.text or "").strip()
    listing_type = context.user_data["listing_type"]
    title = "📦 YÜK İLANI" if listing_type == LISTING_LOAD else "🚚 BOŞ ARAÇ İLANI"
    owner = f"@{user.username}" if user.username else user.full_name
    formatted = (
        f"{title}\n\n"
        f"Çıkış: {context.user_data['origin']}\n"
        f"Varış: {context.user_data['destination']}\n"
        f"Tonaj: {context.user_data['tonnage']}\n"
        f"Kasa Tipi: {context.user_data['body_type']}\n"
        f"İletişim: {context.user_data['contact']}\n"
        f"İlan sahibi: {owner}"
    )
    target_topic = (
        config.loads_topic_id
        if listing_type == LISTING_LOAD
        else config.vehicles_topic_id
    )
    try:
        await context.bot.send_message(
            chat_id=chat.id,
            message_thread_id=target_topic,
            text=formatted,
        )
        await message.reply_text("İlanınız ilgili topic'e formatlı olarak gönderildi.")
    except TelegramError as exc:
        logger.exception("Could not publish listing: %s", exc)
        await message.reply_text(
            "İlan gönderilemedi. Botun topic'e mesaj gönderme yetkisini kontrol edin."
        )

    active_users: set[int] = context.chat_data.setdefault("active_listing_users", set())
    active_users.discard(user.id)
    context.user_data.clear()
    return ConversationHandler.END


async def post_init(application: Application) -> None:
    await application.bot.set_my_commands(
        [
            ("help", "Bot yardımını göster"),
            ("id", "Grup ve topic ID'sini göster"),
            ("load", "Yük ilanı oluştur"),
            ("vehicle", "Boş araç ilanı oluştur"),
            ("links", "Davet ve topic bağlantılarını göster"),
            ("cancel", "Aktif formu iptal et"),
        ]
    )
    me = await application.bot.get_me()
    logger.info("MMT Global Telegram bot started as @%s", me.username)


def build_application(config: Config) -> Application:
    application = (
        Application.builder()
        .token(config.token)
        .post_init(post_init)
        .build()
    )
    application.bot_data["config"] = config
    application.bot_data["strikes"] = defaultdict(int)

    listing_conversation = ConversationHandler(
        entry_points=[
            CallbackQueryHandler(
                begin_from_button, pattern=f"^({CALLBACK_LOAD}|{CALLBACK_VEHICLE})$"
            ),
            CommandHandler("load", begin_load),
            CommandHandler("vehicle", begin_vehicle),
        ],
        states={
            ORIGIN: [MessageHandler(filters.TEXT & ~filters.COMMAND, collect_origin)],
            DESTINATION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, collect_destination)
            ],
            TONNAGE: [MessageHandler(filters.TEXT & ~filters.COMMAND, collect_tonnage)],
            BODY_TYPE: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, collect_body_type)
            ],
            CONTACT: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, collect_contact)
            ],
        },
        fallbacks=[
            CommandHandler("cancel", cancel_listing),
            CallbackQueryHandler(cancel_listing, pattern=f"^{CALLBACK_CANCEL}$"),
        ],
        per_chat=True,
        per_user=True,
        per_message=False,
    )

    application.add_handler(
        MessageHandler(filters.ALL & ~filters.COMMAND, moderate_and_validate),
        group=0,
    )
    application.add_handler(CommandHandler("id", id_command))
    application.add_handler(CommandHandler("start", help_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("links", links_command))
    application.add_handler(listing_conversation, group=1)
    return application


def main() -> None:
    config = Config.from_env()
    logger.info(
        "Configuration loaded: group=%s loads_topic=%s vehicles_topic=%s public=%s",
        config.group_id,
        config.loads_topic_id,
        config.vehicles_topic_id,
        bool(config.public_username),
    )
    build_application(config).run_polling(
        allowed_updates=Update.ALL_TYPES,
        drop_pending_updates=False,
    )


if __name__ == "__main__":
    main()