# Review Workflow

Use this workflow for patch review, branch review, or design review.

## Goal

Identify the highest-signal risks before code is merged or relied on.

## Recommended Skill Bundle

- `high-signal-review` for findings-first output
- `code-review` for the base review contract
- `code-review-checklist` for supplemental prompts
- `release-readiness` when migration or rollout risk is involved

## Process

1. Map the affected code paths first.
2. Review for:
   - correctness
   - security issues
   - regression risk
   - missing tests
   - rollout risk where relevant
3. Prioritize findings over style comments.
4. Cite concrete files, symbols, and reproduction hints.
5. If no findings remain, state residual risk and testing gaps.

## Findings Format

Lead with issues, ordered by severity:

- what is wrong
- why it matters
- where it is
- how it might be reproduced or observed

## Rules

- avoid style-only feedback unless it hides a real bug or maintenance risk
- do not bury material findings under summaries
- if the review scope is unclear, define it first
- use the output check in `high-signal-review/verify.md` before closing a review
