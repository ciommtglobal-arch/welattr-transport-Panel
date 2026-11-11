---
name: Preview routing health
description: Distinguishing healthy artifact services from missing application-router forwarding.
---

A development-domain HTTP 200 alone does not verify application routing or authentication. It can be a generic “Running” placeholder while the actual application router is unavailable.

**Why:** Infrastructure placeholders can return HTTP 200 without reaching the application, so status-only checks can misreport routing or authentication health.

**How to apply:** Check response content, not just status codes. Distinguish internal service health from routed preview health, and do not call a protected UI verified because its backend passed tests. Preserve live domains and data; do not install a duplicate proxy or bypass authentication to make a screenshot pass.
