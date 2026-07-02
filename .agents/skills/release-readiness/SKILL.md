---
name: release-readiness
description: Use when a change may affect rollout, deployment, migrations, or operational stability and needs a higher-confidence validation pass.
---

# Release Readiness

Review whether a change is safe to merge, deploy, and roll back. Focus on concrete release risk, missing safeguards, and validation gaps rather than general code quality.

## Review Focus

Check the change for:

- rollout coupling: feature flags, config switches, sequencing, and phased enablement
- deployment impact: build, env vars, infra assumptions, runtime compatibility, and startup behavior
- migration safety: backward compatibility, data shape transitions, dual-read or dual-write needs, and ordering constraints
- rollback readiness: whether old and new versions can coexist and whether rollback leaves data or traffic in a broken state
- operational stability: alerts, logging, dashboards, runbooks, rate limits, timeouts, retries, and failure containment
- validation quality: whether tests, manual checks, staging verification, or release procedures cover the risky paths

## Workflow

1. Identify the release surface.
Determine what is changing in runtime behavior, data shape, deployment sequencing, operator workflow, or external integrations.

2. Look for ordering assumptions.
Check whether deploy, migrate, backfill, flag flip, cache warmup, or client rollout must happen in a specific order.

3. Test backward and forward compatibility.
Ask whether the previous version can run against the new system state and whether the new version can tolerate partially migrated state.

4. Evaluate rollback realistically.
Do not stop at "can revert the code." Check whether data, config, or one-way side effects make rollback unsafe or incomplete.

5. Inspect observability and blast radius.
Verify that failure would be detectable quickly and contained to a narrow scope when possible.

6. Check validation depth.
Prefer targeted release checks over generic confidence language. Name the missing test, rehearsal, or verification step.

## Output Style

Prioritize findings that could block or complicate release. For each issue, state:

- what could go wrong
- under which deployment or rollout condition it appears
- why existing validation is insufficient
- what concrete mitigation would reduce the risk

Keep summaries brief. Lead with the highest-severity release risks first.

## Common Triggers

Apply extra scrutiny when changes involve:

- schema migrations, backfills, or data rewrites
- new env vars, secrets, or config-dependent paths
- queue, cron, webhook, or worker behavior changes
- auth, billing, cache, or external service integration changes
- feature flag rollout logic or multistep deploy procedures
- changes that require coordination across services, clients, or teams

## Non-Goals

Do not turn this into a general architecture review or style review unless those issues create release risk. Stay focused on deployment safety, compatibility, rollback, and operational confidence.
