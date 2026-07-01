---
name: code-review
description: Review patches, branches, or implementations for correctness, regressions, security, and missing tests. Use when the task is to inspect a diff or code change and identify concrete risks before merge.
---

# Code Review

## Overview

Review for risk, not style theater. Focus on whether the change is correct, whether it breaks adjacent behavior, whether it introduces security or reliability problems, and whether tests cover the new failure surface.

## Primary Output

Lead with findings, ordered by severity. Each finding should state:

1. What is wrong
2. Why it matters
3. Where it is
4. What scenario exposes it

If no findings are discovered, say that explicitly and note any residual uncertainty such as untested paths or limited context.

## Review Workflow

### 1. Establish The Change Surface

- Identify what changed: files, modules, interfaces, schemas, configs, tests.
- Determine whether the review target is a patch, a branch, or a full implementation.
- Understand the intended behavior before judging the implementation.
- Check for related code paths that were not edited but may be affected.

### 2. Read For Behavior, Not Formatting

- Follow inputs through processing to outputs.
- Check state changes, invariants, error handling, and cleanup paths.
- Compare old and new behavior when possible.
- Ignore cosmetic nits unless they hide a real maintenance or correctness risk.

### 3. Hunt For Regressions

- Check existing call sites, contracts, defaults, and migrations.
- Look for partial updates where one layer changed and another did not.
- Inspect failure paths, empty states, null handling, and boundary conditions.
- Verify concurrency, caching, and retry behavior when relevant.

### 4. Review Security And Safety

- Check auth, authz, input validation, escaping, secrets handling, and data exposure.
- Look for trust boundary mistakes and missing server-side enforcement.
- Check whether logs, errors, or metrics leak sensitive data.
- Treat security issues as findings even if they are not immediately exploitable.

### 5. Review Tests

- Check whether tests cover the changed behavior and the main failure modes.
- Look for missing regression tests where the patch fixes a bug.
- Check whether assertions are strong enough to catch the intended breakage.
- Note when coverage exists but misses the risky path.

### 6. Evaluate Operational Risk

- Check migrations, rollout safety, backwards compatibility, and observability.
- Look for irreversible actions without guards or rollback paths.
- Verify metrics, logging, feature flags, or error reporting when they matter.

## Finding Standard

A good finding is concrete and defensible.

Weak finding:

- "This feels brittle."

Strong finding:

- "The new serializer assumes `profile` is always present, but the existing backfill leaves legacy rows null, so this path will raise on production data."

Each finding should be tied to an observable scenario, not just a general preference.

## Severity Guidance

### High Severity

Use for:

- incorrect behavior in common paths
- data loss or corruption
- security exposure
- crashers or deploy blockers

### Medium Severity

Use for:

- realistic edge-case failures
- contract mismatches
- incomplete fixes
- missing regression coverage on risky paths

### Low Severity

Use for:

- maintainability issues likely to cause future bugs
- weak assertions in otherwise useful tests
- minor but real correctness risks with narrow impact

Do not inflate severity to make feedback sound important.

## Decision Rules

- Prefer fewer high-confidence findings over many speculative ones.
- Prefer showing the failing scenario over naming a vague concern.
- Prefer correctness, security, and regression risk over stylistic preferences.
- Prefer noting missing tests when they materially reduce confidence.
- Prefer explicit uncertainty when the review surface is incomplete.

## Output Shape

When writing the review:

1. List findings first, highest severity first.
2. Include file and line references when available.
3. Add open questions or assumptions only after findings.
4. Keep the summary brief and secondary.

If no findings:

- State that no concrete issues were found.
- Mention residual risks such as limited test execution, unclear requirements, or large untouched dependency surfaces.

## Common Review Angles

Check these quickly on most changes:

- input validation
- null and empty handling
- default values
- error paths
- partial updates across layers
- stale callers after interface changes
- test coverage for the changed path
- rollback or migration safety

## Completion Bar

A review is complete when the important risks in the changed behavior have been examined and the output clearly distinguishes confirmed findings from uncertainty or missing context.
