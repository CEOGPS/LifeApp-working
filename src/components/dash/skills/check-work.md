---
name: check-work
description: Verify a change against what was asked. Use when asked to check work, verify, or self-verify.
---

# Check work

1. Restate the request as a short checklist.
2. For each item, say what was actually done and whether you can see the result. Do not treat a plan as a finished action.
3. If code changed, the bar is that it typechecks. Say so only if a check was run. If it was not run, say it was not run.
4. Look for a missing piece, a broken path, and anything extra that was not asked for.
5. End with exactly one line: `VERDICT: PASS` or `VERDICT: FAIL`.
6. On FAIL, name the file or panel and the one change that would fix it. Do not invent a failure to look thorough.
