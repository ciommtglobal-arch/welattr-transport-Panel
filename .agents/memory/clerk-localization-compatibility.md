---
name: Clerk localization compatibility
description: Version compatibility and typing behavior when adding Clerk UI localizations.
---

Clerk localization packages can depend on a newer `@clerk/shared` type version than the installed Clerk React package, producing a TypeScript mismatch even when the localization works at runtime.

**Why:** The UI package and the React SDK may be released on different schedules, and pnpm can keep both shared versions in the workspace.

**How to apply:** Prefer the localization version associated with the installed Clerk React release. If the runtime-compatible resource still has duplicate shared types, isolate the compatibility cast at the single `ClerkProvider` localization prop rather than weakening types across the app.