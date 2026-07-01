# Enhance Workflow

Use this workflow for iterative work on an existing application where the codebase already has established patterns and constraints.

## Goal

Add or evolve behavior without breaking the shape of the existing system.

## Process

1. Inspect the current implementation and feature boundaries.
2. Identify the affected files, contracts, and dependencies.
3. Decide whether the change is small enough for direct execution or needs `plan`.
4. For larger changes, summarize expected scope before editing.
5. Implement incrementally and preserve existing conventions where reasonable.
6. Run `check`, or `verify` if the change crosses multiple subsystems.

## Ask Before Proceeding When

- the change is materially broader than the request implies
- the requested stack conflicts with the current project architecture
- the change would touch many files or create new architectural seams

## Output Shape

- current-state summary
- intended enhancement
- changed scope
- validation
