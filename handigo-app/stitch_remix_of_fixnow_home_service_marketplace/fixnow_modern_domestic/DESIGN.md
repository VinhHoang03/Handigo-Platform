---
name: FixNow Modern Domestic
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e1e7ff'
  surface-container-highest: '#dae2fc'
  on-surface: '#131b2e'
  on-surface-variant: '#464555'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#1e00a9'
  on-primary: '#ffffff'
  primary-container: '#3525cd'
  on-primary-container: '#b1afff'
  inverse-primary: '#c3c0ff'
  secondary: '#00687a'
  on-secondary: '#ffffff'
  secondary-container: '#9ce8fd'
  on-secondary-container: '#076a7c'
  tertiary: '#592000'
  on-tertiary: '#ffffff'
  tertiary-container: '#7d3000'
  on-tertiary-container: '#ff9f72'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#abedff'
  secondary-fixed-dim: '#86d2e6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb694'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fc'
  surface-glass: rgba(255, 255, 255, 0.7)
  surface-glass-dark: rgba(40, 48, 68, 0.7)
  success-green: '#4ade80'
  star-gold: '#facc15'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 56px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.3'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 4px
  sm: 12px
  base: 8px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  container-max: 1280px
---

## Brand & Style
FixNow is a high-end service platform designed to evoke reliability, efficiency, and contemporary comfort. The brand personality is professional yet approachable, targeting urban homeowners who value quality and speed. 

The design style is **Modern / Glassmorphic**. It utilizes a sophisticated mix of clean whitespace (Minimalism) with cutting-edge translucent layers and backdrop blurs (Glassmorphism). This creates a "premium utility" aesthetic—functional enough for quick service booking, yet polished enough to feel like a high-end lifestyle product. Visual elements should feel light, airy, and layered, using soft gradients and floating animations to suggest a seamless, effortless user experience.

## Colors
The color palette is built on a "Fidelity" variant, ensuring brand colors maintain their intended hue and impact across various UI roles.

- **Primary (#3525cd):** An authoritative indigo used for primary actions, branding, and active states.
- **Secondary (#00687a):** A deep teal used for secondary service categories and supporting information.
- **Tertiary (#7e3000):** A warm earth tone reserved for high-visibility accents like star ratings and status indicators.
- **Neutral (#131b2e):** A deep navy-black used for typography and high-contrast elements.

The system relies heavily on **Surface Tonal Layers**. Surfaces vary from pure white (#ffffff) to soft tints like `surface-container-low` (#f2f3ff), creating subtle distinction between sections without harsh borders.

## Typography
The system uses a two-font strategy to balance character with readability.

- **Headlines:** *Hanken Grotesk* provides a sharp, contemporary, and professional look. It is used for all major headers to establish a distinct brand voice. Heavy weights (Bold/700) should be used for the Hero section, while Semi-Bold (600) is sufficient for section headers.
- **Body & Labels:** *Inter* is utilized for its utilitarian and systematic qualities. It ensures high legibility in dense information areas, such as service descriptions and form inputs.

Scale typography intentionally for mobile: XL headlines should drop significantly (approx. 50%) to maintain screen hierarchy without overwhelming the viewport.

## Layout & Spacing
The system follows a **Fixed Grid** philosophy for desktop, centering content within a 1280px maximum width container. 

- **Grid:** Use a 12-column grid for desktop with 24px gutters.
- **Margins:** Global horizontal padding for containers is set to 32px on desktop, scaling down to 16px on mobile.
- **Vertical Rhythm:** Use the `xl` (80px) unit to separate major sections. `lg` (48px) should be used to separate headers from their content blocks.
- **Adaptive Reflow:** On mobile, 4-column desktop grids reflow to 2-column or 1-column stacks. The navigation bar transitions from a docked floating element to a full-width fixed top bar or a simplified bottom-tab bar for easier reachability.

## Elevation & Depth
Visual hierarchy is achieved through a combination of **Ambient Shadows** and **Glassmorphism**.

1.  **Floating Elements:** The primary navigation and high-priority pop-ups use `shadow-lg` (diffused, 10-15% opacity neutral tint) combined with a `backdrop-blur-md` (12px blur) to appear as if they are hovering above the content plane.
2.  **Interactive Cards:** Standard cards use a very subtle `shadow-sm` or `shadow-md` and a thin `outline-variant` border (30% opacity). On hover, these should lift slightly (8px translation) and transition to a deeper `shadow-xl`.
3.  **Tonal Depth:** Background sections use `surface-container-low` to create a recessed feel, pushing the white `surface-container-lowest` cards forward visually.

## Shapes
The shape language is highly **Rounded**, reinforcing the friendly and modern brand persona.

- **Standard Radius:** 0.5rem (8px) for small components like tags and small buttons.
- **Large Radius:** 1rem (16px) or 1.5rem (24px) for cards, search bars, and featured containers.
- **Max Radius (Pill):** Used for "Verified" badges and specialty chips to create a distinct visual contrast from square-form content.
- **Iconography:** Use Material Symbols with a consistent weight and "Fill" property for status-driven indicators.

## Components
- **Buttons:** Primary buttons use `primary-container` background with `on-primary-container` text. They should have a minimum height of 48px for touch targets and utilize a subtle scale-down effect (95%) on active click.
- **Search Bar:** A multi-part input component with integrated location and service search. Use clear dividers and prominent icons to separate functional zones.
- **Glass Cards:** Reserved for floating information (e.g., "Technician arriving"). Must include a semi-transparent background and a high blur factor to ensure readability over varied backgrounds.
- **Service Cards:** Feature a large icon or image, a clear bold title, and a supporting label. The entire card area is interactive.
- **Provider Cards:** High-focus components including a profile image with a 15% corner radius, star ratings in a floating glass tag, and a clear "Online" status pulse indicator.
- **Inputs:** Clean, borderless designs within a container-styled parent. Focus states are indicated by the parent container's shadow or border color shifting to Primary.