# Test Workflow

Use this workflow for targeted test creation, test execution, or coverage-driven validation.

## Goal

Prove behavior with the smallest useful set of tests and report execution clearly.

## Modes

- run existing tests
- add tests for a file or feature
- investigate failures
- review coverage gaps

## Process

1. Inspect existing test conventions and framework.
2. Identify the behavior that must be proven.
3. Choose the smallest test scope with meaningful signal.
4. Add or update tests when behavior is well defined.
5. Run the relevant test command and report the result.

## Testing Priorities

- happy path
- error handling
- edge cases
- integration boundaries when they are part of the changed behavior

## Rules

- do not encode ambiguous product behavior into tests
- prefer targeted tests over sweeping test rewrites
- if a failure is unexpected, pair this workflow with `debug`
