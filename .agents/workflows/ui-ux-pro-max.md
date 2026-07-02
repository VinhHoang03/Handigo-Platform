# UI/UX Pro Max Workflow

Use this workflow for UI design planning, visual redesigns, and implementation-oriented UX decisions.

## Goal

Turn a UI request into an intentional visual and interaction direction before or during implementation.

## Best Paired Skills

- `frontend-design` for visual direction and UX decision-making
- `tailwind-patterns` for Tailwind-heavy implementation
- `nextjs-react-expert` for React or Next.js rendering and performance concerns
- `web-design-guidelines` for accessibility and interface review

## Shared Package

This workflow is backed by the shared package at:

- `.agents/.shared/ui-ux-pro-max/`

Primary entrypoint:

```bash
python3 .agents/.shared/ui-ux-pro-max/scripts/search.py "<query>"
```

## Core Commands

Generate a full design-system recommendation:

```bash
python3 .agents/.shared/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "Project Name"
```

Persist a reusable design system for later page work:

```bash
python3 .agents/.shared/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name"
```

Create a page-specific override:

```bash
python3 .agents/.shared/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name" --page "dashboard"
```

Search one design domain directly:

```bash
python3 .agents/.shared/ui-ux-pro-max/scripts/search.py "<query>" --domain style
python3 .agents/.shared/ui-ux-pro-max/scripts/search.py "<query>" --domain typography
python3 .agents/.shared/ui-ux-pro-max/scripts/search.py "<query>" --domain ux
```

Search stack-specific implementation guidance:

```bash
python3 .agents/.shared/ui-ux-pro-max/scripts/search.py "<query>" --stack html-tailwind
python3 .agents/.shared/ui-ux-pro-max/scripts/search.py "<query>" --stack react
python3 .agents/.shared/ui-ux-pro-max/scripts/search.py "<query>" --stack nextjs
```

## Process

1. Extract the core constraints:
   - product type
   - audience
   - brand tone
   - platform or framework
   - content readiness
2. If the request is vague, clarify:
   - style direction
   - visual density
   - color appetite
   - layout preference
3. Define the design system direction:
   - layout pattern
   - typography strategy
   - color system
   - interaction and motion style
4. Call out anti-patterns to avoid for this specific request.
5. Run `--design-system` first when the request is broad enough to need a full visual direction.
6. Use domain searches for deeper follow-up:
   - `style` for visual language
   - `color` for palette direction
   - `typography` for font pairing
   - `landing` for page structure
   - `ux` for usability and accessibility
   - `react` or `web` for implementation and interface guidance
7. If implementation is required, map the design direction into concrete stack-aware guidance with `--stack`.
8. Validate against usability and accessibility expectations before finalizing.

## Suggested Sequence

For most design tasks:

1. Run `--design-system`
2. Run one or two domain searches only where detail is missing
3. Run `--stack` for the actual implementation framework
4. Synthesize the result into design guidance or code changes

## Available Domains

- `style`
- `prompt`
- `color`
- `chart`
- `landing`
- `product`
- `ux`
- `typography`
- `icons`
- `react`
- `web`

## Available Stacks

- `html-tailwind`
- `react`
- `nextjs`
- `vue`
- `nuxtjs`
- `nuxt-ui`
- `svelte`
- `swiftui`
- `react-native`
- `flutter`
- `shadcn`
- `jetpack-compose`

## Output Shape

- context summary
- design direction
- visual system choices
- anti-patterns to avoid
- implementation notes when code is in scope

## Rules

- do not default to generic AI-safe layouts when the brief supports a stronger direction
- preserve an existing design system unless the user is explicitly asking for a redesign
- if implementation and design are both requested, do design reasoning first and then move into `create` or `enhance`
- prefer the shared search engine over inventing ad hoc palettes, styles, or typography choices
