---
name: debugging
description: Reproduce, isolate, and explain bugs before fixing them. Use when the task is about a bug, regression, failure, flaky behavior, unexpected output, or unclear runtime behavior that must be narrowed to a concrete cause.
---

## Overview

Treat debugging as evidence collection and hypothesis elimination, not guess-and-patch. Reproduce the problem, shrink the failure surface, identify the concrete cause, and only then choose the fix.

## Core Rule

Do not claim the bug is understood until these are true:

1. The failure is reproduced or a credible reproduction gap is documented.
2. The observed behavior is compared against the expected behavior.
3. The failing layer is narrowed down.
4. A specific cause or sharply bounded set of causes is identified.
5. The proposed fix explains why the failure happens.

## Workflow

### 1. Frame The Failure

- State the symptom in one precise sentence.
- Record the expected behavior and the actual behavior.
- Capture the environment: branch, inputs, runtime, feature flags, platform, and timestamps when relevant.
- Preserve raw evidence first: logs, stack traces, screenshots, failing commands, or payloads.

### 2. Reproduce Reliably

- Find the smallest repeatable path to the failure.
- Prefer deterministic reproductions over broad narratives.
- If the bug is flaky, record frequency, triggers, and what changes the hit rate.
- If reproduction fails, document what was tried and what still remains uncertain.

Good reproduction artifacts:

- exact command
- exact request payload
- exact page path and interaction sequence
- exact test case or fixture

### 3. Narrow The Surface Area

- Split the system into layers: input, transport, parsing, business logic, storage, rendering, external dependency.
- Determine where the behavior first becomes wrong.
- Compare a passing case against a failing case.
- Remove variables aggressively: smaller input, fewer services, narrower code path, fewer concurrent actions.

### 4. Build And Test Hypotheses

- Form one concrete hypothesis at a time.
- Use the cheapest test that can falsify it.
- Prefer direct evidence over intuition.
- Keep notes on what has already been ruled out to avoid loops.

Examples:

- "The request body is valid, but the schema coercion drops the optional field before validation."
- "The cache key excludes locale, so a prior response is reused incorrectly."
- "The migration succeeds on clean data but fails on legacy null rows."

### 5. Isolate The Cause

- Identify the exact boundary where correct behavior becomes incorrect.
- Name the mechanism, not just the location.
- Distinguish trigger from cause.
- If multiple causes remain possible, keep isolating instead of picking the favorite.

Weak conclusion:

- "The problem is probably in the backend."

Strong conclusion:

- "The backend serializer omits `status` when the DB row is soft-deleted, which causes the client guard to route to the error state."

### 6. Fix Only After Understanding

- Choose the smallest fix that addresses the identified cause.
- Check nearby call sites, data contracts, and invariants affected by the fix.
- Avoid bundling unrelated cleanup into the debug patch.
- If the cause is external or not fully controllable, add guards, retries, or instrumentation intentionally.

### 7. Prove The Fix

- Re-run the reproduction path.
- Add or update the narrowest test that would have caught the issue.
- Confirm adjacent behavior still works.
- State what evidence now shows the issue is resolved.

## Techniques

### Compare Passing And Failing Cases

- Diff inputs, outputs, logs, and state.
- Look for the first divergence, not the loudest error.

### Reduce The Input

- Make payloads, fixtures, and UI flows smaller until the failure still happens.
- Use the smallest artifact that still reproduces.

### Instrument Intentionally

- Add temporary logs, assertions, or counters only where they answer a hypothesis.
- Remove noisy instrumentation once the cause is found or the fix is verified.

### Check Recent Change Boundaries

- Review recent edits, dependency bumps, config changes, schema changes, and rollout switches.
- Prefer evidence from diffs and execution over assuming the newest change is guilty.

## Decision Rules

- Prefer reproduction before code changes.
- Prefer one falsifiable hypothesis over many vague suspicions.
- Prefer narrowing the boundary over reading more code without a target.
- Prefer a tight regression test over a broad test suite when proving the fix.
- Escalate to the user only when required inputs, access, or production risk block safe debugging.

## Output Standard

When reporting debugging progress or conclusions, include:

1. Symptom
2. Reproduction status
3. Current hypothesis or confirmed cause
4. Evidence
5. Next debug step or fix
6. Remaining uncertainty, if any

## Completion Bar

Debugging is complete when the cause is explained, the fix addresses that cause, and the original failure path no longer reproduces without introducing a nearby regression.