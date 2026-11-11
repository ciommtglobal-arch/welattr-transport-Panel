---
name: Workspace package installation
description: How to add package-specific dependencies when the package helper cannot target a pnpm workspace.
---

When a dependency belongs to one artifact or library, install it into that workspace rather than the monorepo root. If the package helper rejects the root operation and does not accept `--filter`, use a workspace-scoped pnpm add as the fallback.

**Why:** The package helper runs from the workspace root, where pnpm's root-add guard rejects package-specific dependencies, and it validates package tokens before pnpm sees filter flags.

**How to apply:** Confirm the target package first, run a scoped add for that package, address peer-version warnings, then verify the affected package typecheck/build.

For security upgrades, auditing only direct versions is insufficient. In this workspace, both installation after a parent upgrade and a recursive targeted update retained older, vulnerable semver-compatible transitive entries.

**Why:** A newer parent does not guarantee that its previously locked child dependencies are refreshed.

**How to apply:** Re-audit the resolved lock graph after upgrades. If affected children remain, use narrow, same-major patched-version overrides and validate consumers; never disable the release-age protection or blindly force unrelated major versions.