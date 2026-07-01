---
name: repo-onboarding
description: Use when entering an unfamiliar repository and you need a fast, dependable map of the runtime, quality gates, risk zones, and safest next steps before making changes.
---

# Repo Onboarding

Build context from the real execution path, not from folder names alone.

## Selective Reading Rule

| File | Purpose | Read When |
| --- | --- | --- |
| `handoff.md` | compact output shape for the onboarding brief | before summarizing findings |

## Workflow

1. Read the top-level manifest, README, and directory layout.
2. Find the actual app entrypoints and how the app starts in development and production.
3. Identify build, lint, type-check, test, and deployment commands.
4. Mark generated code, secrets boundaries, migrations, and high-risk integration points.
5. Summarize the codebase in a compact note before proposing edits.

## Deliverable

Produce an onboarding brief with:

- stack summary
- important directories
- entrypoints and run commands
- quality gates
- likely risk zones
- safest next step for the current task

## Preferred Pairings

- Workflow: `.agents/workflows/plan.md` or `.agents/workflows/debug.md`
- Primary subagent: `explorer`
- Common supporting skills: `architecture`, `plan-writing`, `systematic-debugging`
- Hand off to `planner` or `implementer` only after the map is concrete enough

## Avoid

- assuming the biggest folder is the main product
- proposing broad refactors before understanding execution flow
- treating docs as ground truth when code says otherwise
