---
name: mcp-onboarding
description: Use when choosing, evaluating, or rolling out MCP servers and you need practical guidance on fit, trust boundaries, setup, and safe team adoption.
---

# MCP Onboarding

Adopt MCP servers deliberately. The goal is useful context and tools without widening risk or support burden.

## Selective Reading Rule

| File | Purpose | Read When |
| --- | --- | --- |
| `rollout-checklist.md` | readiness and adoption checklist | when deciding whether to add or roll out a server |

## Evaluation Order

1. Clarify the user workflow the MCP server should improve.
2. Check whether local files, built-in tools, or existing skills already solve most of it.
3. Evaluate server trust boundaries, auth model, data exposure, and maintenance burden.
4. Define a minimal rollout path with one or two high-value use cases.
5. Document setup, permissions, failure modes, and owner responsibilities.

## Rollout Checklist

- clear use case
- known data sources
- auth and secret handling plan
- sandbox and approval expectations
- setup steps verified
- fallback path if the server is down

## Preferred Pairings

- Workflow: `.agents/workflows/plan.md` or `.agents/workflows/verify.md`
- Primary subagent: `docs_researcher`
- Common supporting skills: `mcp-builder`, `documentation-templates`
- Pull in `security_auditor` when the server reaches sensitive systems or credentials

## Avoid

- adding MCP servers because they look generally useful
- giving broad access before the real need is clear
- skipping ownership and maintenance expectations
