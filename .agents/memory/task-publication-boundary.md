---
name: Task publication boundary
description: Why tested edits in an isolated task can be absent from a successful production publication.
---

Task checkpoint commits are not proof that edits have reached the user's main project. Publishing builds the applied main-project changes, not every isolated task's working copy. A task workspace can report its branch as `main`; that alone does not establish that its edits are publishable from the user's project.

**Why:** A route worked in the task preview and was committed locally, but a subsequent successful publication served a newer bundle without that route. Official task documentation confirmed that parallel tasks use isolated copies whose changes must be applied before publishing.

**How to apply:** Before asking the user to publish a task fix, establish that it has been applied to the main project. If a successful new publication lacks the fix, do not keep asking the user to republish or treat this as browser cache. Check the task-to-main handoff. Never mark unfinished real-account verification complete just to transfer an unrelated fix; request an explicit scope split when necessary.

Completion transfer can also fail before validation because the destination repository cannot be accessed, even when the task workspace is a valid Git repository and Git LFS is installed.

**Why:** A completion attempt failed at the destination fetch rather than at a source-code check; local repository checks alone did not establish that the main-project handoff was available.

**How to apply:** Preserve the existing checkpoints, distinguish transfer failure from failed tests, and do not claim that edits reached the main project. Retry the handoff once rather than changing application code or disabling large-file support to work around a repository-access failure.