---
name: VIP payment split
description: The durable payment architecture and rollout constraint for MMT Global VIP access.
---

MMT Global VIP access uses a dedicated bot separate from the public logistics bot. Telegram Stars is the first payment method; Wallet Pay/TON-USDT is an optional second method that must remain disabled until Wallet Pay grants merchant access and provides a store API key.

**Why:** Wallet Pay rejected the current onboarding account with `not_wallet_user`, so displaying or accepting Wallet payments before merchant approval would create an unverifiable payment path.

**How to apply:** Keep the Stars flow operational independently. Do not request, log, or hardcode Wallet credentials until merchant onboarding succeeds; then add Wallet Pay through its official order and webhook flow.

Personal wallet connection is separate from Wallet Pay merchant checkout. Official Wallet help documents TON Connect for the self-custodial DeFi Account, with older references to TON Space; confirm the user's actual wallet type before choosing a connection method.

**Why:** A rejected merchant application does not establish that a personal wallet cannot connect. Treating a wallet address or Telegram identity alone as ownership would also allow the wrong wallet to be linked.

**How to apply:** Do not bypass Wallet Pay approval to enable collection, but do not apply that merchant gate to a connection-only flow. Keep existing MMT authentication; bind a wallet to an account only after wallet ownership proof and the user's confirmation. Never request recovery words, private keys, or the user's wallet password.