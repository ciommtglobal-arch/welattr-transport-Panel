import asyncio
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from telegram.ext import CommandHandler

from pilot_mode import (
    PILOT_REFERENCE,
    build_pilot_application,
    pilot_command,
    run_pilot,
    safe_error,
)

TEST_CONFIG = SimpleNamespace(
    token="123456789:TEST_ONLY_NOT_A_REAL_TOKEN",
    contact_admin_ids=frozenset({71001}),
)


def event(user_id=71001, chat_type="private", chat_id=None):
    return SimpleNamespace(
        effective_chat=SimpleNamespace(
            id=user_id if chat_id is None else chat_id, type=chat_type,
        ),
        effective_user=SimpleNamespace(id=user_id),
        effective_message=SimpleNamespace(reply_text=AsyncMock()),
    )


class PilotTests(unittest.IsolatedAsyncioTestCase):
    async def test_authorized_private_command_is_explicitly_test_only(self):
        update = event()
        context = SimpleNamespace(bot_data={"pilot_allowed_users": frozenset({71001})})
        await pilot_command(update, context)
        text = update.effective_message.reply_text.await_args.args[0]
        self.assertIn(PILOT_REFERENCE, text)
        self.assertIn("Lojistik dosyası tamamlandı: HAYIR", text)
        self.assertIn("veritabanını okumaz veya değiştirmez", text)

    async def test_unlisted_private_user_gets_no_response(self):
        update = event(user_id=71002)
        await pilot_command(
            update, SimpleNamespace(bot_data={"pilot_allowed_users": frozenset({71001})}),
        )
        update.effective_message.reply_text.assert_not_awaited()

    async def test_group_and_mismatched_identity_get_no_response(self):
        for update in (event(chat_type="supergroup"), event(chat_id=71002)):
            await pilot_command(
                update, SimpleNamespace(bot_data={"pilot_allowed_users": frozenset({71001})}),
            )
            update.effective_message.reply_text.assert_not_awaited()

    def test_pilot_registers_no_listing_or_moderation_handlers(self):
        with patch.dict(os.environ, {}, clear=True):
            application = build_pilot_application(TEST_CONFIG)
        handlers = [handler for group in application.handlers.values() for handler in group]
        self.assertTrue(all(isinstance(handler, CommandHandler) for handler in handlers))
        self.assertEqual(len(handlers), 1)
        self.assertEqual(handlers[0].commands, frozenset({"start", "help", "pilot"}))
        self.assertIsNone(application.post_init)

    def test_no_recipients_fails_closed(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError):
                build_pilot_application(SimpleNamespace(token="unused", contact_admin_ids=frozenset()))

    def test_production_fails_closed(self):
        for environment in ({"REPLIT_DEPLOYMENT": "1"}, {"NODE_ENV": "production"}):
            with patch.dict(os.environ, environment, clear=True):
                with self.assertRaises(RuntimeError):
                    build_pilot_application(TEST_CONFIG)

    async def test_webhook_and_pending_updates_are_preserved(self):
        for hook in (
            SimpleNamespace(url="https://example.invalid/hook", pending_update_count=0),
            SimpleNamespace(url="", pending_update_count=2),
        ):
            application = AsyncMock()
            application.bot.get_webhook_info.return_value = hook
            with patch("pilot_mode.build_pilot_application", return_value=application):
                with self.assertRaises(RuntimeError):
                    await run_pilot(TEST_CONFIG)
            application.start.assert_not_awaited()
            application.bot.get_updates.assert_not_awaited()
            application.bot.delete_webhook.assert_not_called()

    async def test_loop_stops_cleanly_without_webhook_mutation(self):
        application = AsyncMock()
        application.bot.get_webhook_info.return_value = SimpleNamespace(
            url="", pending_update_count=0,
        )
        application.bot.get_updates.side_effect = asyncio.CancelledError()
        with patch("pilot_mode.build_pilot_application", return_value=application):
            with self.assertRaises(asyncio.CancelledError):
                await run_pilot(TEST_CONFIG)
        application.start.assert_awaited_once()
        application.stop.assert_awaited_once()
        application.bot.delete_webhook.assert_not_called()

    async def test_error_log_does_not_include_provider_error_text(self):
        context = SimpleNamespace(error=RuntimeError("SENSITIVE_PROVIDER_URL"))
        with self.assertLogs("mmt-telegram-pilot", level="WARNING") as captured:
            await safe_error(None, context)
        self.assertNotIn("SENSITIVE_PROVIDER_URL", " ".join(captured.output))


if __name__ == "__main__":
    unittest.main()
