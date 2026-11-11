---
name: Media pilot publication
description: Approval and real-publication boundary for MMT Global pilot media.
---

Keep media review and founder content approval separate from evidence of real publication. A manual social-post link is a claim from the operator, not proof: hold it in a pending state until the founder checks the actual post and the authorized account. A successful Telegram API response is publication evidence for that direct channel. TEST records and legacy records without pilot classification cannot enter either path.

**Why:** Former media records could be marked published without an external post. A syntactically valid link alone can also be wrong or point at an unauthorized account.

**How to apply:** Preserve that distinction in future scheduling, public feeds, metrics, and integrations. Do not silently turn a queued, approved, TEST, or unverified manual record into a published one.