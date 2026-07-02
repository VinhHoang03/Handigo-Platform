---
name: test-hardening
description: Use when a test suite is flaky, shallow, or easy to bypass and you need stronger coverage around critical behavior, failure modes, and regression boundaries.
---

# Test Hardening

Strengthen trust in the system by improving the tests that matter most, not by maximizing test count.

## Selective Reading Rule

| File | Purpose | Read When |
| --- | --- | --- |
| `verify.md` | decide whether the new tests truly prove behavior | after authoring or tightening tests |

## Focus Areas

- flaky tests and nondeterministic setup
- critical business flows with weak assertions
- edge cases around errors, retries, empty states, and bad inputs
- integration points that are mocked too aggressively
- missing regression coverage for recent incidents

## Workflow

1. Identify the highest-risk behaviors that lack reliable proof.
2. Remove avoidable flakiness from setup, timing, and shared state.
3. Add tests at the lowest level that still proves the behavior.
4. Tighten assertions so tests fail for the right reason.
5. Verify the suite is still maintainable and fast enough to run often.

## Deliverable

Summarize:

- what was previously unproven
- what is now covered
- any remaining blind spots
- follow-up tests worth adding later

## Preferred Pairings

- Workflow: `.agents/workflows/test.md` or `.agents/workflows/verify.md`
- Primary subagent: `test_writer`
- Common supporting skills: `testing-patterns`, `tdd-workflow`, `webapp-testing`
- Pair with `debugger` when the expected behavior is still not well understood

## Avoid

- snapshot-heavy tests with weak intent
- duplicating implementation details across tests
- adding slow end-to-end coverage when a targeted integration test would prove the same behavior
