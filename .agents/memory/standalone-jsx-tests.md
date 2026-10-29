---
name: Standalone JSX test runtime
description: Vite and independent tsx/server-render tests do not necessarily share JSX transforms.
---
Independent `tsx` server-render tests do not inherit Vite's automatic JSX transform; a component can render in Vite while the standalone test fails with `React is not defined`.

**Why:** The frontend uses a Vite JSX transform, while standalone tests use a different compilation path; selecting the frontend tsconfig alone does not resolve this when JSX is preserved.

**How to apply:** Distinguish a test compilation failure from an application failure. Ensure the standalone test runtime has a compatible JSX transform or an explicit React binding; do not alter authentication or application permissions to fix it.
