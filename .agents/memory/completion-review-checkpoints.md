---
name: Completion review checkpoints
description: How to interpret the working tree after a rejected project-task completion review.
---

A rejected project-task completion review can still leave the edits submitted for that review committed in git.

**Why:** The working-tree diff may then show only follow-up fixes, which can look like earlier changes disappeared even though they remain in the latest commit.

**How to apply:** After a rejected completion attempt, inspect git history and confirm intended behavior in the current files before reapplying or rewriting any edits.