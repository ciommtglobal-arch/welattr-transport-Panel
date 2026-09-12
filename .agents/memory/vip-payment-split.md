---
name: VIP payment split
description: The durable payment architecture and rollout constraint for MMT Global VIP access.
---

MMT Global VIP access uses a dedicated bot separate from the public logistics bot. Telegram Stars is the first payment method; Wallet Pay/TON-USDT is an optional second method that must remain disabled until Wallet Pay grants merchant access and provides a store API key.

**Why:** Wallet Pay rejected the current onboarding account with `not_wallet_user`, so displaying or accepting Wallet payments before merchant approval would create an unverifiable payment path.

**How to apply:** Keep the Stars flow operational independently. Do not request, log, or hardcode Wallet credentials until merchant onboarding succeeds; then add Wallet Pay through its official order and webhook flow.