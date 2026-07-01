# Verify Workflow

Use this workflow for release-sensitive or cross-cutting changes.

## Goal

Establish higher confidence than `check` for changes that are broad, risky, or close to release.

## Recommended Skill Bundles

- `test-hardening` when validation depends on stronger automated proof
- `docs-shipper` when the change must ship with accurate operational docs
- `mcp-onboarding` when rollout depends on an external MCP server
- `release-readiness` for cross-cutting release risk

## Default Checks

1. Run broader automated coverage than `check`.
2. Review config, migrations, and compatibility edges.
3. Verify deploy or rollback assumptions if rollout risk exists.
4. Check operational coupling:
   - secrets
   - background jobs
   - external integrations
   - schema compatibility
5. Produce a concise release-readiness summary.

## When To Use

- deployment-affecting changes
- cross-cutting refactors
- migrations
- auth, billing, or critical-path behavior
- changes where failure cost is meaningfully high

## Output Shape

- broader validation run
- release blockers or warnings
- explicit note on anything still unverified
- if a specialized skill bundle was used, include the relevant verification notes from that bundle
