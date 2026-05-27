---
name: FixNow Design System
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464555'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#00687a'
  on-secondary: '#ffffff'
  secondary-container: '#57dffe'
  on-secondary-container: '#006172'
  tertiary: '#7e3000'
  on-tertiary: '#ffffff'
  tertiary-container: '#a44100'
  on-tertiary-container: '#ffd2be'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  container-max: 1280px
  gutter: 24px
---

## Brand & Style
The design system is engineered for a premium home services marketplace, balancing high-end reliability with the rapid efficiency of a modern tech startup. The brand personality is "The Dependable Expert"—highly professional, technologically advanced, and frictionless.

The aesthetic leans into **Modern Minimalism** with a **Glassmorphic** overlay layer. It prioritizes clarity and whitespace to reduce the cognitive load of booking complex services. The user experience should feel "airy" and expensive, using subtle motion and depth to guide the user through the service lifecycle.

**Core Principles:**
- **Clarity over Decoration:** Every element serves a functional purpose.
- **Precision:** Perfect alignment and consistent mathematical spacing.
- **Tactile Trust:** Using depth and soft shadows to make digital elements feel physically reliable.

## Colors
The palette is rooted in a deep **Indigo (#4F46E5)** to establish authority and trust, supported by a vibrant **Cyan (#06B6D4)** for secondary actions and progress indicators. **Orange (#F59E0B)** is used sparingly for high-attention alerts, such as "Urgent Booking" or "Low Availability."

**Application Rules:**
- **Primary Indigo:** Main buttons, active navigation states, and brand-heavy headers.
- **Secondary Cyan:** Successful confirmations, "Verified" badges, and interactive toggles.
- **Neutrals:** A scale of Blue-Greys (Slate) is used for text and borders to maintain a cool, modern temperature. Pure black is avoided in dark mode in favor of a deep navy-charcoal (#020617) to maintain depth.

## Typography
This design system utilizes **Hanken Grotesk** for headlines to provide a sharp, contemporary edge that distinguishes the brand from generic SaaS platforms. **Inter** is used for all functional body text and interface labels to ensure maximum legibility and systematic performance.

Type hierarchy is strictly enforced. Large headlines should use negative letter spacing to feel "tight" and editorial. Body text uses generous line heights to ensure readability when users are scanning service descriptions or provider reviews.

## Layout & Spacing
The layout follows a **12-column fluid grid** for desktop and a **single-column fluid layout** for mobile. We utilize a strict 8px spatial grid.

- **Desktop:** 12 columns, 24px gutters, 80px side margins.
- **Tablet:** 8 columns, 16px gutters, 40px side margins.
- **Mobile:** 4 columns, 16px gutters, 16px side margins.

Horizontal sections should be separated by `lg` (48px) or `xl` (80px) spacing to maintain the "premium minimalist" feel. Cards and widgets should use `md` (24px) internal padding.

## Elevation & Depth
Depth is created through a combination of **Ambient Shadows** and **Glassmorphism**. 

1.  **The Base Layer:** Solid background (#F8FAFC).
2.  **The Surface Layer (Cards):** White background with a 1px Slate-200 border and a "Soft" shadow (Y: 4px, Blur: 20px, Opacity: 5%).
3.  **The Floating Layer (Modals/Dropdowns):** Glassmorphic surfaces with a 1px semi-transparent border, 20px backdrop-blur, and an "Elevated" shadow (Y: 12px, Blur: 30px, Opacity: 10%).

In Dark Mode, shadows become darker and more concentrated, and glass effects use a 10% opacity white tint to catch the "light."

## Shapes
The shape language is dominated by **extra-large radii (2xl)** to evoke friendliness and modern comfort. 

- **Standard Elements (Buttons, Inputs):** 0.5rem (8px).
- **Large Containers (Cards, Modals):** 1.5rem (24px).
- **Special Elements (Status Badges, Search Bars):** Fully rounded (Pill).

Icons should always use a rounded cap and join style to match the UI's softness.

## Components

### Modern Sticky Navbar
The navbar is a floating glass container (`backdrop-blur-md`) with a 1px border. It should sit 16px from the top of the viewport with a "dock" appearance rather than spanning edge-to-edge.

### Service & Provider Cards
Cards utilize the "Surface Layer" elevation. Images should have a 16px border radius. Information is stacked with the price point in the top-right corner using a Primary Indigo label. Use subtle hover transitions (Scale 1.02) to indicate interactivity.

### Search Bars
Search bars are pill-shaped with a 1px Slate-200 border. On focus, the border transitions to Primary Indigo with a 4px soft outer glow.

### Status Badges
Badges use high-saturation backgrounds at 10% opacity with 100% opacity text for high contrast and readability. 
- *Pending:* Orange
- *Confirmed:* Cyan
- *Completed:* Indigo

### Dashboard Widgets
Widgets use a "No Border" approach, relying entirely on white/dark-navy fills and soft ambient shadows to define their boundaries against the background. They should have a consistent 24px internal padding.

### Buttons
- **Primary:** Solid Indigo with white text.
- **Secondary:** Transparent with Indigo 1px border.
- **Tertiary/Ghost:** No border, Indigo text, Slate-100 background on hover.