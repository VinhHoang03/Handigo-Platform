---
name: planning
description: Produce implementation plans that are decision-complete and execution-ready. Use when the task needs decomposition, sequencing, acceptance criteria, explicit assumptions, risk handling, or a concrete plan before coding or operational work starts.
---
# Planning

## Overview

Turn ambiguous work into a plan another agent can execute without reopening core decisions. Resolve scope, sequence, constraints, and definition of done before treating the plan as complete.

## Output Standard

Produce plans that answer all of these points:

1. Goal: what will be true when the task is done.
2. Scope: what is included and what is explicitly excluded.
3. Assumptions: facts treated as true until disproved.
4. Dependencies: tools, services, approvals, inputs, or files required.
5. Sequence: the ordered work with critical-path awareness.
6. Acceptance criteria: observable checks for completion.
7. Risks: likely failure modes and how to handle them.
8. Open questions: only if they block a safe decision.

Do not leave the plan at a vague "investigate" level unless the task itself is discovery work.

## Workflow

### 1. Frame The Request

- Restate the intended outcome in concrete terms.
- Identify the artifact to produce: code change, migration, document, deployment, analysis, or decision.
- Distinguish hard constraints from preferences.
- Call out missing inputs that materially affect the path.

### 2. Define Boundaries

- State what the plan will cover.
- State what it will not cover.
- Convert broad asks into a smallest useful deliverable if full scope is unclear.
- Prefer one coherent scope over a mixed list of loosely related tasks.

### 3. Decompose The Work

- Break the task into units that have a clear completion signal.
- Separate setup, implementation, validation, rollout, and cleanup when relevant.
- Identify which steps can run in parallel and which are blocking.
- Keep decomposition shallow unless the task is large or high risk.

Good step wording:

- "Inspect the current auth flow and list the request/response contracts."
- "Add the database column and backfill existing rows."
- "Update the API handler and client call sites to use the new field."
- "Run focused tests for migration and regression coverage."

Weak step wording:

- "Handle backend"
- "Do frontend stuff"
- "Test everything"

### 4. Sequence For Execution

- Order steps so each one unlocks the next with minimal rework.
- Put irreversible or high-blast-radius work after validation where possible.
- Move expensive steps later if cheaper checks can fail first.
- Call out prerequisites before dependent implementation steps.

### 5. Make Decisions Explicit

- Choose defaults when the evidence is good enough.
- Record the decision and brief rationale.
- Surface tradeoffs only when they affect implementation or risk.
- Ask a question only when the answer changes the plan materially and a safe assumption is not available.

### 6. Define Acceptance Criteria

- Write criteria that are externally verifiable.
- Prefer outcomes over activity.
- Tie each criterion to behavior, data state, interface contract, or delivery artifact.
- Include validation commands or checks when known.

Examples:

- "The endpoint returns `409` for duplicate slugs and preserves the existing response schema for other cases."
- "The migration completes on existing data without null violations."
- "The page renders correctly on mobile and desktop with no console errors."

### 7. Address Risks And Unknowns

- List the few risks that are most likely or most costly.
- Pair each risk with a mitigation, checkpoint, or fallback.
- Mark unknowns as blocking only when proceeding would be unsafe or wasteful.
- If discovery is required, define the exact question to answer and the artifact expected from that discovery.

## Decision Rules

- Prefer a smaller plan that can be executed now over a larger plan with unresolved core choices.
- Prefer concrete nouns and verbs over category labels.
- Prefer acceptance criteria that can fail clearly.
- Prefer assumptions plus caveats over unnecessary back-and-forth.
- Revise the plan if new facts invalidate sequencing or scope.

## Plan Shapes

Use the lightest structure that still removes ambiguity.

### Small Task

Use a short plan with:

- outcome
- 3-5 ordered steps
- acceptance criteria

### Medium Task

Use:

- outcome and scope
- assumptions and dependencies
- ordered implementation steps
- validation steps
- risks

### Large Or High-Risk Task

Use:

- outcome, scope, and non-goals
- architecture or rollout decisions
- phased sequence with dependencies
- validation matrix
- rollback or fallback approach
- unresolved questions, if any

## Completion Bar

A plan is decision-complete when a competent implementer can start work without asking:

- what to do first
- what success looks like
- what assumptions are in force
- which risks need active handling
- whether major product or technical decisions are still pending

If those answers are missing, the plan is not finished.