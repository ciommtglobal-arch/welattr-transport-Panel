---
name: Task publication boundary
description: Why tested edits in an isolated task can be absent from a successful production publication.
---

Task checkpoint commits are not proof that edits have reached the user's main project. Publishing builds the applied main-project changes, not every isolated task's working copy. A task workspace can report its branch as `main`; that alone does not establish that its edits are publishable from the user's project.

**Why:** A route worked in the task preview and was committed locally, but a subsequent successful publication served a newer bundle without that route. Official task documentation confirmed that parallel tasks use isolated copies whose changes must be applied before publishing.

**How to apply:** Before asking the user to publish a task fix, establish that it has been applied to the main project. If a successful new publication lacks the fix, do not keep asking the user to republish or treat this as browser cache. Check the task-to-main handoff. Never mark unfinished real-account verification complete just to transfer an unrelated fix; request an explicit scope split when necessary.