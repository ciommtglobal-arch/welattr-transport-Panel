---
name: Artifact validation temporary files
description: Temporary manifest lifecycle when using the required artifact validator.
---

Treat the temporary manifest passed to `verifyAndReplaceArtifactToml` as disposable and check whether it still exists before editing it again.

**Why:** A successful replacement consumed the temporary input; a subsequent patch to that input failed because the file no longer existed.

**How to apply:** For another change, recreate a fresh temporary copy from the current validated manifest, preserve unrelated metadata, and validate it again. Never edit the canonical manifest directly.