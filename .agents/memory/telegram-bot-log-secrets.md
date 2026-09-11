---
name: Telegram bot log secrets
description: The Telegram Bot API token is embedded in request URLs, so HTTP request logging must not run at INFO.
---

Telegram bot services must keep `httpx`, `httpcore`, and `telegram.request` logging at WARNING or higher.

**Why:** The Bot API token appears in the request URL; verbose HTTP logs can expose the token even when the application never prints the secret directly.

**How to apply:** Apply the logger-level guard before starting polling and rotate the token immediately if verbose request logs were enabled.