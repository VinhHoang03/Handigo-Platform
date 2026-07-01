# Check Workflow

Use this workflow for quick validation during normal development.

## Goal

Confirm the changed behavior with the smallest validation scope that gives real confidence.

## When To Use

- normal implementation work
- small bug fixes
- narrow refactors
- before handing a routine patch back to the user

## Default Checks

1. Run the smallest relevant automated test scope.
2. Run lint or typecheck only where it adds signal.
3. Verify the changed behavior manually if automation is absent.
4. Record anything not validated.

## Escalation Rules

Promote the task to `verify` when any of the following apply:

- config, infra, migrations, or env handling changed
- behavior crosses multiple subsystems
- release risk is non-trivial
- the validation signal from `check` is too weak

## Output Shape

- commands run
- result summary
- anything skipped
- residual risk if validation was partial
