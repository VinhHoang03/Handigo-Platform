# Orchestrate Workflow

Use this workflow only for complex work that genuinely benefits from multiple focused subagents.

## Goal

Coordinate bounded subagent work without losing a coherent main-thread plan.

## When To Use

- the task spans multiple independent domains
- distinct workstreams can proceed in parallel without stepping on each other
- review, docs verification, or test writing can run alongside implementation

## Process

1. Define the immediate critical-path task that the main agent should own.
2. Identify sidecar tasks that can run in parallel.
3. Assign each subagent a narrow responsibility and bounded write scope.
4. Pass enough context:
   - user request
   - relevant files
   - known decisions
   - expected output
5. Continue non-overlapping local work while subagents run.
6. Integrate returned results and run final validation.

## Good Delegation

- `planner` for decomposition
- `docs_researcher` for API verification
- `reviewer` for a focused risk pass
- `test_writer` for targeted test coverage
- `implementer` for a disjoint code slice

## Rules

- do not delegate the immediate blocking task if you need the answer right away
- avoid parallel edits to the same write set
- do not spawn subagents just because the task is large
