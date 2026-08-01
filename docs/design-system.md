# Yapper Design System

The live reference is available at `/style-guide`. This document records the
rules that code review should enforce across the website, desktop app, and
mobile app.

## Sources of truth

- Theme, type, spacing, radius, and width tokens: `src/app/globals.css`
- Standard action component: `src/components/ui/button.tsx`
- Marketing page container: `.marketing-container`
- Studio page container: `StudioContentFrame`
- Live specimens and usage guidance: `src/app/style-guide/page.tsx`

## Typography

Yapper uses Hanken Grotesk for display and body copy.

- `.type-display` and `.type-h1`: one route title or hero headline
- `.type-h2`: major section heading
- `.type-h3`: feature, card, or subsection heading
- `.type-description`: supporting explanation
- `.type-label`: quiet orientation above a heading

Do not introduce route-specific font sizes when a semantic type class fits.
Do not use monospace for marketing labels, feature names, navigation, or
decorative interface copy. Monospace is reserved for code, timecodes, file
metadata, and technical data.

## Buttons

All standard actions use `Button` from `src/components/ui/button.tsx`.

- `default`: primary Yapper action
- `contrast`: high-contrast action on artwork or cinematic surfaces
- `outline`: secondary action
- `ghost`: tertiary action in toolbars and menus
- `link`: inline navigation that still behaves like an action

Sizes are semantic:

- `sm`: navigation and compact toolbars
- `default`: normal product and marketing actions
- `lg`: hero forms and high-priority actions
- icon sizes: icon-only actions with an accessible label

Do not recreate padding, radius, weight, shadows, or hover behavior in a page.
Tabs, segmented controls, timeline tools, and destructive media controls may
use specialized components when their interaction is materially different from
a button.

## Layout

- Marketing and public routes use `.marketing-container`, max width 1200px.
- Studio dashboard routes use `StudioContentFrame`, max width 1440px.
- Full-height editors may fill the available workspace inside the Studio shell.
- Section spacing follows the 4px token scale. Prefer 24, 32, 48, 64, and 96px.

## Content

Every section needs one clear job:

1. The heading states the outcome or user job.
2. The description names what Yapper does and why it matters.
3. The action names its destination or result.

Use sentence case. Keep the same action label wherever the action is the same.
Avoid decorative system language that does not help someone understand the
product.

## Theme

Page backgrounds, text, borders, and standard surfaces use semantic `--sg-*`
tokens. Every section must be reviewed in light and dark mode. Cinematic feature
artwork may keep a controlled dark canvas, but the surrounding page must follow
the active theme.

## Review checklist

- Uses the correct shared container
- Uses semantic type classes
- Uses the shared Button component for standard actions
- Uses Hanken Grotesk only, unless showing code or time data
- Works in light and dark mode
- Has visible keyboard focus and accessible labels
- Respects reduced motion
- Contains no invented badges or decorative technical language
