---
name: Orphaned preview listeners
description: Managed artifact workflows may fail on restart while old process groups continue serving their assigned ports.
---

A FAILED managed artifact workflow does not always mean its service is unavailable. An older process can remain bound to the artifact port after environment recovery, causing the next managed start to fail with an address-in-use error.

**Why:** The preview appeared inconsistent while both the website and API workflows reported failure; their older listeners still answered requests, and new managed processes could not bind.

**How to apply:** When a managed workflow reports address-in-use, inspect the existing listener and process ownership before retrying. Clear only the stale artifact process groups, then restart the exact managed workflow; do not add replacement workflows or change ports to hide the conflict.