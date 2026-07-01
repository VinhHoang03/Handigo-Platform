---
name: bug-hunt
description: Use when a bug is real but poorly scoped and you need a disciplined pass to reproduce it, bound it, and isolate the most likely root cause before fixing.
---

# Bug Hunt

Treat the first pass like an investigation, not a rewrite.

## Selective Reading Rule

Read only what sharpens the investigation.

| File | Purpose | Read When |
| --- | --- | --- |
| `verify.md` | proof checklist after the fix | once the failure mode is understood |

## Workflow

1. Restate the failure in terms of observable behavior.
2. Reproduce it with the smallest reliable path.
3. Narrow the boundary: input, environment, recent change, or data shape.
4. Check logs, traces, tests, and call paths for evidence before editing code.
5. Fix the confirmed failure mode with the smallest defensible change.
6. Add or strengthen a test so the bug stays fixed.

## Deliverable

Produce a short bug brief with:

- reproduction steps
- expected vs actual behavior
- suspected root cause
- evidence collected
- fix strategy
- regression test plan

## Preferred Pairings

- Workflow: `.agents/workflows/debug.md`
- Primary subagent: `debugger`
- Common supporting skills: `debugging`, `systematic-debugging`, `testing-patterns`
- Follow-up subagent when the bug is understood: `test_writer`

## Avoid

- guessing root cause from the first stack trace
- changing multiple systems before reproduction is stable
- calling the issue fixed without a proving test or clear verification step
