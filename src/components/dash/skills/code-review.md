---
name: code-review
description: Strict maintainability review. Use when asked for a code review or a quality audit.
---

# Code review

Review for structure, not style nits.

- Prefer deleting a branch over adding another special case.
- Do not praise a file that grows past a thousand lines without a split.
- Flag feature checks leaked into shared code.
- Flag `any`, needless casts, and wrappers that do not change behavior.
- Flag a second helper that duplicates one already in the file.
- A working change can still fail the review if it makes the path harder to follow.

Order the notes: structural problem, missed simplification, tangled branches, types, file size.

Do not approve only because it runs. Say what should change, with the file name.
