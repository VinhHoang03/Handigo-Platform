# Figma To Code Workflow

Use this workflow when the user wants to implement an existing Figma design in the current codebase with high visual fidelity.

## Goal

Turn a specific Figma frame or node into production code that matches the repository's design system, responsive behavior, and implementation conventions.

## Best Paired Skills

- `frontend-design` for layout, visual translation, and UI judgment
- `clean-code` for scoped implementation quality
- `web-design-guidelines` for accessibility and interaction review

## Best Paired Tools

- Figma MCP or equivalent design-context tooling for node metadata, screenshots, and assets
- Playwright or an equivalent browser runner for visual verification

## Entry Criteria

Before starting, confirm:

- a specific Figma file, frame, or node is available
- the target code surface in the repository is known
- the relevant design system, component library, or token source is discoverable

If those conditions are not met, route first to `plan` or `ui-ux-pro-max`.

## Process

1. Fetch the exact design context for the requested frame or node.
2. If the design payload is too large, fetch metadata first and then re-fetch only the needed nodes.
3. Capture a screenshot of the exact reference variant before coding.
4. Inspect the target code path, shared components, tokens, and existing patterns.
5. Reuse the current design system instead of creating duplicate components or ad hoc styles.
6. Implement the screen in small increments, preserving responsive behavior and interaction details.
7. Run the local preview and compare the implementation against the Figma reference.
8. Use browser-based checks to verify layout, spacing, states, and responsive behavior.
9. Iterate until the implementation is close enough to the design or the remaining mismatch is explicitly documented.
10. Run `check` before presenting the result.

## Suggested Sequence

1. `get_design_context` for the exact node or frame
2. `get_metadata` only if the first response is too broad or truncated
3. `get_screenshot` for the exact variant and breakpoint
4. inspect the repository implementation path and design system
5. implement the UI
6. run preview and browser verification
7. summarize what matches and what remains approximate

## Output Shape

- Figma source used
- target code path
- reused components and tokens
- verification method and result
- remaining visual or behavior gaps

## Rules

- do not start from a vague screenshot when a concrete node or frame exists
- do not replace the repository's design system with raw Figma values unless the project has no reusable abstraction
- do not declare visual parity without browser comparison or an explicit manual check
- preserve accessibility semantics while matching the design
