---
name: Environment presence audits
description: Interpret normal environment variables and secret-existence results separately during readiness audits.
---

Determine effective variable presence from both the environment-variable groups and the secret-existence map. A false secret-existence entry does not mean a key is missing if it is configured as an ordinary environment variable.

**Why:** A readiness audit initially misclassified configured ordinary variables when the secret-existence map overwrote the environment-variable result.

**How to apply:** Combine presence across shared and target-environment variables with secret existence using OR, not last-write-wins. Report only presence and source; never print values.
