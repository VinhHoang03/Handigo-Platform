# Create Workflow

Use this workflow for net-new features, scaffolding, or structured implementation work.

## Goal

Turn a concrete request into a minimal, defensible implementation.

## Entry Criteria

Before starting, confirm:

- the requested behavior is specific enough to implement
- obvious product ambiguities are resolved
- affected scope is understood from repository context

If those conditions are not met, move to `brainstorm` or `plan` first.

## Process

1. Inspect the current code, interfaces, and affected paths.
2. Identify the narrowest subagent and skills for the job.
3. Decide whether the work is direct execution or needs a plan checkpoint first.
4. Implement in small, defensible increments.
5. Keep unrelated files untouched unless they are required dependencies of the change.
6. Run the `check` workflow before presenting the result.
7. Summarize changed behavior, validation, and remaining risks.

## Typical Skill Pairings

- `clean-code` for scoped implementation quality
- `testing-patterns` or `tdd-workflow` when tests should be added alongside code
- `frontend-design` for UI-heavy work
- `api-patterns` or `database-design` for server-side structure changes

## Rules

- do not invent hidden product policy
- do not broaden scope without telling the user
- ask before major multi-file or architecture-expanding changes
