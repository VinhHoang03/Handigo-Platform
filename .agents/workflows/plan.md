# Plan Workflow

Use this workflow when the user wants an implementation plan before code changes.

## Goal

Produce a decision-complete plan that someone could execute without re-discovering the problem.

## Process

1. Inspect the current code or repository layout first.
2. Define:
   - target behavior
   - explicit non-goals
   - dependencies and constraints
3. Break the work into sequenced implementation steps.
4. Capture API, data, migration, and config changes if any.
5. Call out risky assumptions and open questions.
6. Define validation and acceptance criteria.

## Good Plan Characteristics

- grounded in the real repository, not generic advice
- ordered by dependency
- explicit about risks and unknowns
- clear about what will be validated at the end

## Output Shape

- short objective
- current-state summary
- step-by-step plan
- risks and open questions
- validation plan
