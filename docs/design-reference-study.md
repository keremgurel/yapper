# Design reference study: Agentwork, Apple, Chatbase, Voiceflow

Written 2026-09-22. Values are measured, not guessed. Agentwork and Chatbase were read from live computed styles in a browser tab. Apple's numbers come from the typography classes shipped in apple.com's own homepage stylesheet. Voiceflow's come from its stylesheets plus the godly.design gallery captures, since the site itself blocked the automation tab. Colours are given as the nearest hex to what the site renders.

## Agentwork

**Typography.** One family, Mona Sans (a variable grotesque), at three optical weights that read as one voice: 550 for display, 510 for headings and buttons, 410 for body. The scale is short. Hero 48px on 55px leading with -1.44px tracking (about -0.03em). Section heading 24px on 32px, -0.72px. Body 20px on 30px for the lead paragraph, otherwise 16px and a lot of 14px for UI text (14px is the most common size on the page by a wide margin). Small labels 12px. Nothing is bolder than 550.

**Colour.** A warm near-black on a warm off-white: ink about #21201C on a page of #FDFDFC, with white cards. The primary button is that same ink filled, the secondary is a pale grey fill, and there is no third colour in the interface. The only saturated colour on the page lives inside product screenshots.

**Spacing.** Sections are 80px top and bottom, every one of them. The content container is 1200px; reading columns inside it are 720px and 588px. Buttons are 40px tall with 10px radius and 12px horizontal padding, so the button is a compact object rather than a wide pill.

**Hierarchy.** Size and tracking do the work. The hero is big and tight, the section heading is half its size, and body is calm and wide-set. There is one filled button per view. Cards are white on off-white with no visible border, so grouping comes from the tone shift, not from lines.

## Apple

**Typography.** SF Pro Display above 20px, SF Pro Text below it. The scale on the homepage is 56, 48, 40, 32, 28, 24, 19, 17, 14, 12. Display sizes are weight 600 with leading around 1.07 to 1.12 and tracking that flips sign as the size drops: -0.005em at 56px, -0.002em at 48px, 0 at 40px, +0.002em at 32px, +0.007em at 28px, +0.009em at 24px. Body is 17px on 1.47 at weight 400 with -0.022em tracking, reduced body 14px on 1.43 at -0.016em, caption 12px on 1.33 at -0.01em. That sign flip is the point: large display text is tightened, mid sizes are opened up, and text sizes are tightened again because SF's text cut is designed for it.

**Colour.** Ink #1D1D1F, secondary #6E6E73, tertiary #86868B, hairline #D2D2D7, page white and #F5F5F7 for alternating bands, and one blue, #0071E3, for links and the primary call to action. Product photography carries all remaining colour. Nothing decorative is tinted.

**Spacing.** Alternating full-width bands, each one product, with the headline centred and generous empty space above and below. Buttons are pills (fully rounded) and two sizes only. Tiles in the product grid sit on 12px gutters. Vertical rhythm is set per band rather than by a fixed section padding, but bands are never shorter than the viewport's top half.

**Hierarchy.** One idea per band. Headline, one line of subhead, one or two text links. The eye is never asked to choose between two competing calls; the second action is a plain blue text link, not a second button.

## Chatbase

**Typography.** Two families with clear jobs: Geist for headings, Inter for everything else, plus an italic serif used on two or three words inside the hero headline as the only flourish. Hero 64px on 70px at weight 500 with -2.56px tracking (-0.04em). Section heading 48px on 53px, -0.96px. Card heading 24px on 31px, -0.48px. Lead paragraph 20px on 28px at weight 500, -0.4px. UI text 14px on 21px at weight 500, -0.28px. Weight 500 everywhere, so hierarchy is size and tracking, never boldness.

**Colour.** Pure white page, near-black text, a mid grey for secondary copy. The primary button is black with white text; the secondary is white with a hairline. One deep blue panel in the hero carries a line-art pattern, and that is the only large colour field on the page. Logos are shown in grey.

**Spacing.** Sections are 80px top and bottom. Buttons are 48px tall for primary actions and 36px in the nav, with 8px radius and 20px horizontal padding. Logo strip cells are hairline-separated boxes, no shadows.

**Hierarchy.** The hero puts the whole message in one 64px sentence with the italic serif pointing at the two words that matter. Below it the page moves in a strict 48 to 24 to 14 ladder. Every card has the same shape, so the eye reads the grid as one system.

## Voiceflow

**Typography.** A serif display (Tiempos Headline) at weight 400 for the hero and section titles, a sans (UCity Pro) for body and interface, and Fira Code for code samples. The serif is set large and tight with short lines, two lines at most, and the sans body under it is 16px with roomy leading. Nav and UI text are 14px. The serif is what makes the site feel considered rather than templated; the sans keeps the product parts crisp.

**Colour.** Warm white page, near-black text, muted grey secondary, hairline borders at 4 percent black, and one saturated blue used for the primary button and links. Photography is landscape imagery with muted tones, so the blue stays the only strong hue.

**Spacing.** Two content widths: 64rem (1024px) for text-led sections and 81rem (1296px) for wide layouts, plus 85rem for the nav. Band gap 4.5rem (72px), body padding clamp(2rem, 3.5vw, 3.5rem), and large quotes get clamp(4rem, 8vw, 7rem). Cards use a shared radius token and a shadow that only appears on hover.

**Hierarchy.** Serif headline, sans subhead, one blue button, then an image. Stats and proof points sit in hairline-ruled rows rather than cards. Motion is reserved for the hero media and hover states.

## The shared DNA

All four are built on the same seven decisions.

One neutral pair does the work: near-black ink on near-white paper, warm rather than pure in three of the four. Secondary text is a grey a few steps lighter, never a colour.

One accent, for one job. Apple's blue, Voiceflow's blue, Agentwork's and Chatbase's black-filled button. The accent marks the action you are meant to take and nothing else. Categories, icons and decoration never borrow it.

Display type is large, tight, and light. Heroes run 48 to 64px with tracking between -0.02em and -0.04em and leading near 1.1, at weights between 400 and 600. None of them uses 700 or above for headings; contrast comes from size and tracking.

Body is set for reading. 16 to 20px, leading 1.4 to 1.5, weight 400 or 500, on a measure of 600 to 720px. UI chrome sits at 14px with 12px only for captions.

A fixed vertical beat. Sections at 80px (Agentwork, Chatbase) or 72px (Voiceflow) top and bottom, and containers at 1200 to 1300px. The rhythm is boring on purpose so the content can vary.

Objects are quiet. Buttons are 40 to 48px tall with 8 to 10px radii or full pills, one filled and one outlined. Cards are separated by tone shifts or hairlines, not by shadows. Borders never nest.

Hierarchy is a ladder, not a soup. Each page has a clear size ladder (64 or 48, then 24, then 14 to 16) and every element sits on one rung. Nothing is emphasised twice.

## What all four deliberately avoid

- A second accent colour, or the accent on anything that is not an action.
- Decorative gradients, glows and coloured washes as backgrounds for ordinary sections. The one exception is a single hero panel.
- Heavy weights. Nothing above 600 anywhere, and most headings are 500.
- Uppercase eyebrow labels stacked above every section. Apple and Chatbase use none. Agentwork uses small labels sparingly.
- Text under 12px.
- Shadows on resting cards, borders inside borders, and dashed outlines.
- Icon rows as decoration. Icons appear inside controls or not at all.
- Marketing-sized type inside product surfaces. Apple's product UI stays at 17px body and 12 to 14px controls no matter how big the homepage headline is.
- More than one filled button in view.
- Motion that moves layout. Hover states change colour, shadow or scale by a few percent; nothing slides on scroll.

## A design system to plug into Claude Design

Paste the block below as the system description. It is written for Yapper, with the one accent set to the brand orange, but every value is a token you can swap.

```
DESIGN SYSTEM: Yapper Studio

Feel: calm, precise, Apple-grade. A tool, not a landing page. Contrast comes from size, tracking and spacing, never from colour or weight.

TYPE
Family: the platform system font (SF Pro on Apple devices; system-ui elsewhere). No second family. Mono (SF Mono / Menlo) only for numerals: durations, counts, timecodes.
Scale (px / line-height / weight / tracking):
  Hero 56 / 1.07 / 600 / -0.02em   (marketing only)
  Display 40 / 1.1 / 600 / -0.01em (marketing only)
  Section 28 / 1.15 / 600 / 0
  Page title 22 / 1.2 / 600 / -0.01em
  Card title 17 / 1.3 / 600 / -0.01em
  Hero body 17 / 1.6 / 400 / -0.015em   (scripts, teleprompter)
  Body 15 / 1.5 / 400 / -0.01em
  UI 14 / 1.45 / 500 / 0
  Label 13 / 1.4 / 500 / 0 (sentence case)
  Meta 12 / 1.35 / 400 / 0
  Floor: nothing under 12px. Weights allowed: 400, 500, 600. Never 700+.
Measure: prose max 68ch, descriptions max 60ch.
Uppercase: at most one small uppercase label per group, 11 to 13px, +0.08em tracking. Never stack them.

COLOUR
Ink ramp (warm): 950 #141314, 900 #201D1D, 700 #3D3A3A, 500 #837E7E, 400 #A9A4A4, 300 #CBC7C7, 200 #E2E0E0, 100 #EFEEED, 50 #F6F5F3.
Light: page #FBFAF8, card #FFFFFF, sunken #F3F1EE, hairline #E2E0E0, text #201D1D, secondary #5B5656, tertiary #837E7E.
Dark: page #141314, card #1C1A1A, sunken #232020, hairline #2B2828, text #F3F1EE, secondary #A9A4A4, tertiary #837E7E.
Accent: orange, face #F97316 with the metal treatment described under CONTROLS. Used for exactly: the one primary button per view, selected state, active tab underline, focus ring. Never for labels, icons, categories, or decoration.
Status hues (chips only): cyan = in progress, yellow = waiting, green = done, violet = AI-written. Neutral = default.
No gradients outside the primary button, no glows, no translucent washes on page surfaces. Translucency only on floating chrome (toolbars, sheets) with backdrop blur.

SPACING
Base 4px. Allowed gaps: 4, 8, 12, 16, 24, 32, 48, 64.
Page gutter 24px (16px on phones). Container 1200px. Section spacing 48px in product surfaces, 80px on marketing pages.
Card padding 16px, hero surfaces 20px. Table rows 40px tall. Form field to label 6px, field to field 24px.

SHAPE
Radius: controls 10px, cards 12px, sheets and hero surfaces 16px, chips full pill. Buttons: 44px default, 36px compact, 52px hero, 14 to 20px horizontal padding.
Depth: three levels only. Page, card (1px hairline, no shadow), sunken well (tone shift, no border). A bordered thing never sits inside another bordered thing. Shadows only on floating overlays.
Empty states: sunken 40px icon circle, one sentence, one action. No dashed boxes.

CONTROLS
Exactly two button styles in product surfaces. Primary: the orange metal button (gradient face, gradient bezel ring, inner specular edge, layered cast shadow that collapses on press). It is the only gradient in the system and appears once per view. Secondary: hairline outline on the card surface. Ghost is for icon buttons and inline toolbar actions only. No black filled buttons, no pills, no hand-rolled button classes.
Inputs: hairline border, 8px radius, 15px text, grow with content. Labels above in sentence case at 13px/500.
Icons: 16px inside controls, 20px standalone, never decorative in headings.

MOTION
Durations 140ms for colour and opacity, 240ms for reveals and sheets, ease-out. Animate transform and opacity only. Springs (no bounce) for anything the user drags. Respect prefers-reduced-motion with cross-fades.

LAYOUT
Nav, content and footer share one container and one gutter. One idea per section. Headline, one line of support, at most one action.

DO NOT
Two accents. Bold everywhere. Uppercase eyebrows on every block. Em dashes in copy. Text below 12px. Left colour rails on cards or callouts. Dashed borders. Cards inside cards. Hover lifts on rows.
```

## What this means for Yapper today

The Studio design language already agrees with most of this; the gaps are the ones the audit found in code: 21 files still use 10px text, five Studio surfaces use dashed boxes for empty states, the brand and editor-gate pages use 900-weight titles, a few surfaces use translucent washes, and the calendar chip and the blog callout carry coloured left rails. Those are mechanical fixes and are being made in the same pass as this document.
