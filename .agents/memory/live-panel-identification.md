---
name: Live panel identification
description: Distinguishing the intended founder management screen from the company invitation panel during mobile troubleshooting.
---

When a user says the live panel is old or frozen, confirm the visible screen title and published site before continuing company-invitation instructions. Do not assume they mean the B2B company panel. Recheck current deployment metadata before directing the user to another project.

**Why:** A screenshot revealed a founder “Yönetim Merkezi” screen after repeated company-panel instructions. The unchanged visual appearance had been mistaken for an outdated build, and the user's intended screen was not the one being investigated. The custom domain's serving application and its association in deployment metadata changed during troubleshooting; the earlier result no longer justified telling the user to open a different project.

**How to apply:** Use the visible screen title and non-secret site domain to establish the troubleshooting target. Compare fresh deployment metadata and responses from both the custom domain and the platform URL. A healthy API or current invitation buttons do not prove an authenticated management screen works.

For Telegram mini apps, establish the exact external launch URL before claiming the reported failure is fixed. Bot display names and paths in pasted troubleshooting examples are not evidence of the configured launch URL. A candidate compatibility route can be checked in preview without verifying the actual Telegram launch.

**Why:** A Telegram screenshot showed a generic English 404 while the workspace website used a different error screen. Pasted Flask and Express examples supplied possible fixes, but did not identify which website or page the mini app opened.

**How to apply:** Distinguish a preview route correction, its publication, and successful launch inside Telegram. Report each separately; do not treat a passing preview screenshot as verification of the user's mini app.