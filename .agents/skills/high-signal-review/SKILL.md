---
name: high-signal-review
description: Use when reviewing code, a patch, or a design and you want concise findings that focus on correctness, risk, regressions, and missing validation instead of style chatter.
---

# High-Signal Review

Lead with the issues most likely to hurt users, operators, or future change velocity.

## Selective Reading Rule

| File | Purpose | Read When |
| --- | --- | --- |
| `verify.md` | final output standard for the review | before delivering findings |

## Review Order

1. Correctness and broken assumptions
2. Security and unsafe trust boundaries
3. Behavioral regressions and migration risk
4. Missing tests, observability, and rollback gaps
5. Maintainability only when it materially affects the above

## Output Rules

- Start with findings, ordered by severity
- Explain impact, trigger condition, and why it matters
- Reference the exact file and line when possible
- Keep summaries short and secondary to findings

## Good Findings

- a real edge case that now fails
- a missing guard on external input
- a migration path that breaks old data
- a test gap that leaves critical behavior unproven

## Preferred Pairings

- Workflow: `.agents/workflows/review.md`
- Primary subagent: `reviewer`
- Common supporting skills: `code-review`, `code-review-checklist`, `release-readiness`
- Escalate to `security_auditor` or `performance_optimizer` when the risk axis is specialized

## Avoid

- long style lists
- speculative architecture debates with no user impact
- praise-heavy reviews that bury the blocking issue
