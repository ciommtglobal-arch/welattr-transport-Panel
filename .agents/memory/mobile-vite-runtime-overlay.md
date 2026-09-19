---
name: Mobile Vite runtime overlay
description: Development preview behavior when mobile browsers emit error events without a usable Error message.
---

The Vite runtime error overlay should ignore only the exact message-less placeholder `(unknown runtime error)` emitted by mobile browser resource/error events. Runtime errors with a meaningful message must remain visible.

**Why:** iOS/mobile preview sessions can show a blocking Replit overlay even while the application and API are healthy; the overlay has no actionable stack or message and interrupts form flows.

**How to apply:** Configure the development-only runtime overlay filter narrowly. Do not disable the overlay wholesale, and verify the workflow and a mobile preview after changing the Vite configuration.