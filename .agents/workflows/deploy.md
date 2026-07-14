# Deploy Workflow

Use this workflow for production or staging deployment preparation and execution.

## Goal

Move from "code is ready" to "deployment is safe enough to run" with clear pre-flight checks and rollback awareness.

## Modes

- `deploy check`: pre-flight only
- `deploy preview`: stage or preview deployment
- `deploy production`: production deployment
- `deploy rollback`: rollback planning or execution

## Process

1. Confirm target environment and deployment platform.
2. Run `verify`-level checks if release risk is non-trivial.
3. Confirm required env vars, secrets, and config.
4. Build or package the application using the project's actual deployment path.
5. Deploy using the platform-specific command or pipeline.
6. Run smoke checks and health checks.
7. Record deployed version, URL, and rollback path.

## Pre-Flight Checklist

- build succeeds
- tests and validation match release risk
- secrets are not hardcoded
- environment configuration is accounted for
- migrations are ordered and reversible where possible
- monitoring or smoke checks are defined

## Output Shape

- target environment
- commands or pipeline used
- deployment result
- smoke check result
- rollback note
