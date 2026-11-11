---
name: Vite publish environment
description: Build-time environment behavior for Vite artifacts in this workspace
---

Static Vite builds can be evaluated without the service environment variables that are present when preview servers run. Treat `PORT` and `BASE_PATH` as runtime configuration with safe build-time defaults, while retaining validation for explicitly supplied invalid values.

**Why:** A workspace or publishing build can invoke Vite without `PORT`/`BASE_PATH`; throwing during config evaluation prevents otherwise valid static assets from being generated.

**How to apply:** When adding or reviewing Vite configs for workspace artifacts, make build-independent settings default safely and verify the full workspace build without manually exporting service variables.