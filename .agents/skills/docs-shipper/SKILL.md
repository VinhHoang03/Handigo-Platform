---
name: docs-shipper
description: Use when documentation needs to be published, refreshed, or aligned with the actual product behavior, commands, and failure cases instead of sounding generally correct.
---

# Docs Shipper

Documentation should reflect the current product, not an idealized version of it.

## Selective Reading Rule

| File | Purpose | Read When |
| --- | --- | --- |
| `verify.md` | final doc quality gate | before shipping docs |

## Workflow

1. Verify behavior from code, commands, and current output.
2. Identify the reader: newcomer, operator, maintainer, or contributor.
3. Write the shortest path that gets that reader to success.
4. Include prerequisites, exact commands, expected results, and failure recovery.
5. Update related docs together when one change would otherwise create drift.

## Good Docs

- describe what exists today
- include exact file paths and commands
- call out unsafe assumptions and common failure cases
- separate quick start from reference detail

## Preferred Pairings

- Workflow: `.agents/workflows/ship.md` or `.agents/workflows/verify.md`
- Primary subagent: `documentation_writer`
- Common supporting skills: `documentation-templates`, `mcp-builder`
- Use `docs_researcher` when external API or framework claims need confirmation

## Avoid

- copying marketing phrasing into setup docs
- documenting commands that were not checked
- hiding breaking changes in long prose
