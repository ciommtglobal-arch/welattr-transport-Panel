---
name: Workspace package installation
description: How to add package-specific dependencies when the package helper cannot target a pnpm workspace.
---

When a dependency belongs to one artifact or library, install it into that workspace rather than the monorepo root. If the package helper rejects the root operation and does not accept `--filter`, use a workspace-scoped pnpm add as the fallback.

**Why:** The package helper runs from the workspace root, where pnpm's root-add guard rejects package-specific dependencies, and it validates package tokens before pnpm sees filter flags.

**How to apply:** Confirm the target package first, run a scoped add for that package, address peer-version warnings, then verify the affected package typecheck/build.