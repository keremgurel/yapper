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

Yapper uses the platform system sans for display and body copy (SF Pro on Apple
devices, system-ui elsewhere), as defined in `globals.css`.

## Public website direction

Ypr.app presents the Yapper content creation product only. The homepage is `/`,
pricing is `/pricing`, and existing blog URLs remain available. Training has moved
to https://speakingpractice.ai/. The public wordmark stands alone: do not add a
redundant “Studio” product label or divider beside it. Legacy public coaching
routes redirect to the training site. The public site
uses compact product navigation, clear explanatory text, and examples of the
creator's work. Keep Chirpy. The public site defaults to light mode and retains
a manual light/dark toggle. Public Studio entry actions use the shared Button's
`titanium` variant: dark graphite metal on light pages, light aluminum on dark
pages. Label them “Access Studio” and link directly to `/studio/home`. The
homepage hero and closing section each have one action; the signed-out header
has one Studio entry button. Page
surfaces remain quiet; no ornamental gradients, glows, or colored accent rails.

The public `.marketing-site` type scale is 40–64px for the homepage headline,
36–56px for page headings, 28–40px for section headings, and 20–24px for feature
headings. Headings use 500–600 weight and 1.08–1.2 line height. Body copy is
16–18px with 1.6 line height; navigation is 14px with 400–500 weight. Keep prose
within 65ch. Use sentence case throughout.

Header, dropdowns, main content, and footer share `.marketing-container`,
1360px maximum including gutters of 20px mobile, 24px tablet, and 32px desktop.
Sections use 48px mobile and 80px desktop spacing. A narrower text column must
sit inside this container. Light/dark semantic colors come from existing sg
tokens. Dark page canvases are pure black (#000); elevated surfaces stay distinct. Restore the original CinematicThemeSwitcher at its established 52×32px display size.

Menus support pointer, touch, keyboard, Escape, and focus return. Mobile
navigation uses one disclosure level. Interaction motion is brief and respects
reduced motion. Examples are labeled as examples, never customer evidence.
Studio offers a 7-day trial. Pricing presents one membership with a monthly/yearly
selector and one shared feature list. Use a neutral bordered surface, 32px between
the account summary and membership, and 64px above the pricing intro (40px mobile).
Keep every section aligned to the shared outer container; never add nested gutters.

- `.type-display` and `.type-h1`: one route title or hero headline
- `.type-h2`: major section heading
- `.type-h3`: feature, card, or subsection heading
- `.type-description`: supporting explanation
- `.type-label`: quiet orientation above a heading

Do not introduce route-specific font sizes when a semantic type class fits.
Do not use monospace for marketing labels, feature names, navigation, or
decorative interface copy. Monospace is reserved for code, timecodes, file
metadata, and technical data.

## Authentication

`/sign-in` and `/sign-up` use a shared branded shell with the marketing container,
system typography, theme switch and semantic surfaces. A 1100px inner layout
pairs a quiet workflow introduction with a 400px form on desktop. Below 900px,
show the form alone; retain the shared outer gutters and allow natural scrolling.
Five soft, solid workflow tiles echo the homepage's Brainstorm, Script, Record,
Edit and Crosspost sequence. No decorative card surrounds the form.

Use Clerk's maintained components with the shadcn base theme and scoped appearance
classes. Inputs and authentication buttons have 52px targets, 16px input text and
visible keyboard focus. The primary action reuses the shared titanium variant.
Clerk handles configured identity providers, verification, recovery and account
switching. Auth pages are public with noindex metadata; Studio and its API keep
their existing authentication gates. Preserve Clerk's return URL, with Studio
home as the fallback. Native handoff pages retain their separate flow.

## Buttons

All standard actions use `Button` from `src/components/ui/button.tsx`.

- `default`: primary Yapper action
- `titanium`: public Studio entry, graphite in light mode and aluminum in dark
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

- Marketing and public routes use `.marketing-container`, max width 1360px.
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
- Uses the system sans only, unless showing code or time data
- Works in light and dark mode
- Has visible keyboard focus and accessible labels
- Respects reduced motion
- Contains no invented badges or decorative technical language

## Product demonstration direction — October 1 refinement

Lead public pages with concrete product categories and short, useful outcomes.
Avoid conversational cross-sell paragraphs and slogans that replace the category.
Product media combines editorial creator imagery with readable, functional
interface demonstrations: script, camera, transcript cuts, captioned frame,
and publishing preparation. Use one consistent sample project throughout.
The generated creator image is sample content, never a customer testimonial.
Do not add visible sample captions or technical preview labels; do not make invented
analytics, ratings, distribution success, or release promises. Keep the shared
container and semantic palette. Product controls use 12px minimum labels, 44px
interactive targets where practical, and visible focus. No decorative app-window
traffic lights, tilted cards, floating badges, or ambient glows.

### Product-first page composition

Homepage: centered, restrained headline and a short description above one full-width
Studio screen. Hero copy max 700px, screen uses the shared outer container. No
half-width app mockup. Desktop previews import the shipped presentation components
(script, hook, library rows, teleprompter and destination cards) with local sample
data. No camera, account, publishing or AI calls in marketing previews. A compact
phone composition on narrow screens is explicitly a mobile design concept.
Use 12–14px UI labels, 16px script text, 16px body, and 13px availability notes.
Feature discovery uses aligned horizontal groups with concise descriptions and
visible link affordances. Keep the creator portrait; remove invented transcript
editing controls and fake coaching feedback. Product labels and availability belong
beside their corresponding product, not in a separate cross-sell strip.

### Motion and material refinements

Supaste is the reference for giving each feature a focused, readable product demo.
Use actual web presentation components with isolated sample state; the native
editing demo recreates the native workbench, portrait player, transcript and media timeline. Show a continuous take splitting, unwanted segments disappearing, gaps closing and captions appearing. One-click progress is supporting status, not the whole editor. The hero is one large interactive screen. Feature sequences can play
only while visible in a foreground tab, without playback buttons, and use static completed frames under reduced motion. User requested Libraries.dev Voice for voice input, chromatic Metal for
selected actions, and Thinking Orbs for one-click processing; keep their original
palettes. Original CSS gradients are allowed behind demo media, not behind body copy.
Neat was evaluated and removed at the user’s request; no runtime dependency or watermark.

Implementation references: https://www.supaste.com/ (demo framing and hierarchy),
Libraries.dev voice/metal/orbs. Demo backgrounds are original CSS color fields.
Native one-click status imports the official ThinkingOrbsKit SwiftUI port, pinned
under native-macos/Vendor with its upstream commit and MIT license.

Preview media does not need visible sample labels or technical footers. Keep the scene concise. Writing previews use 13–14px script text and 18–21px hook text.

The large editor demo uses a continuous, wrapping transcript with inline cut marks,
without a decorative tool-tab row. During the automated first pass, the original
step-by-step one-click editing sheet overlays the workbench while the timeline
continues splitting and closing gaps below. Dismiss the sheet on completion.
On phones, the sheet covers the upper workspace and leaves the timeline visible.
The smaller “Your timeline” feature card uses only the original progress checklist.

### Workflow sequences

Use the same creator story across the demonstrations. The Ideas tab shows voice
input appearing as text, automatic classification, then a new row in the real
library component. The Write tab pairs the real script and hook components with
Chirpy: a dictated request, three alternatives, a selected hook, a second request,
and a visible script revision. These are scripted demonstrations with no microphone,
account, or AI requests. Keep the smaller edit card as the progress checklist.
The large editor uses a longer continuous transcript with three distinct retakes
and three pauses: remove retakes in one batch, then pauses in a second batch. Keep source times
stable and derive the remaining duration from the surviving clips.

The Record tab is an interactive teleprompter using the product scrolling engine.
Speed, text size, prompt height and shade update immediately. Use Libraries.dev
Gooey for its moving range thumb and segmented selection indicators, with native
range/keyboard semantics intact. This interactive demo may have start/pause/restart
controls; passive sequences remain automatic. Respect reduced motion by requiring
an explicit start, and stop scrolling when offscreen or in a background tab.
A restrained blue/lilac shadow may trace the main demo screen’s border.

### Product navigation and finishing materials

Yapper is the umbrella brand. The products are Yapper Studio (creation) and
Yapper Train (speaking practice). The header reads the product from the URL
(`src/data/site-navigation.ts`). Brand pages (home, pricing, legal) show Studio,
Train and Pricing. Inside a product the header shows the product name beside
the wordmark, that product's own menu and call to action, and one quiet text
link to the other product at 13px in the muted text color. A product's menu
never links into the other product. Menus are titled columns of links in the
shared container. The footer has one column per product. Train’s canonical
product page is /products/train; retain a permanent redirect from
/products/yapper.
Dark mode keeps a pure black page with neutral graphite surfaces (#171719),
raised graphite (#222225), and neutral silver text. Use translucent glass only
on the Chirpy assistant and processing overlays: blur, a fine neutral edge and
an inset highlight, with opaque readable fallbacks. No colored accent rails.
Editor motion selects and removes all three retakes together, then all three
pauses together, preserving source offsets and rippling each batch closed.
Publishing shows platform-specific copy generation, a sample thumbnail remix,
then a local send sequence. Thinking Orbs communicates generation; Border Beam
traces the preparing action. Platform icons travel from the action to destinations.
All demonstration state is local, respects visibility and reduced motion, and
never sends a post, requests microphone access, or calls generation APIs.

Demo geometry is invariant during playback. Reserve the full height of changing
copy and controls; constrain Chirpy conversations and library lists to internal
scroll regions. Alternatives, generation, and success states must not resize
the demo frame or shift surrounding page content, at desktop or phone widths.

Teleprompter demo type uses a demo-specific 14/18/22/26px scale (S–XL),
with M selected initially. Compact 36px segmented controls and a narrower
settings column keep attention on the recording; coarse pointers retain
44px targets. Do not change the actual recorder’s settings presets.

The five Studio demo tabs share one translucent glass capsule. A Libraries.dev
Gooey selection moves between equal-width slots on pointer selection; keyboard
and reduced-motion changes are immediate. A static blue/lilac/mint halo behind
the screen perimeter diffuses upward behind the glass. These are absolute
visual layers with no effect on layout or hit targets.

Ideas is a sequential scene, never a capture/library split. Voice input and
automatic classification occupy the first scene; it recedes as the library
arrives with the saved idea. Both are absolutely positioned within the same
480px frame (desktop and phone). Enter/exit use short opacity, scale and vertical
movement, with immediate changes under reduced motion.

Status badges use MetalStatusBadge: the Libraries.dev “New” badge’s chromatic
metal, white core, fine rim, and dark label, with intrinsic width for longer
text. Resting state is frozen; animate only on mouse hover and never under
reduced motion. Keep the label present and dimensions stable before shader load.
The homepage eyebrow is just “Private beta”, without a second product label.

The Studio tab selection uses the Liquid Glass SDK in a bounded scene with a
clear refracting lens and one fine neutral rim. Keep the existing capsule shape,
equal tab widths, icons, labels, and responsive dimensions. No blue-grey tint, double bevel,
opaque fill or bright highlight strips. Pointer-down compresses it; a
horizontal drag tracks directly, with subtle liquid stretch. Release snaps to
the projected tab and commits selection; cancellation restores the current tab.
Vertical touch movement remains page scrolling. Click and keyboard selection
remain alternatives, icons and labels stay side by side at all widths, and
reduced motion suppresses spring/press effects.

Feature landing pages focus on one offering. Use one breadcrumb, the feature’s
headline, and only its dedicated preview; workflow-switching tabs belong on the
homepage and Studio overview. Put related features in a final “See how it all
fits together” section. Captions, calendar and library have separate previews.
The workflow tab is labelled “Script”. The idea capture scene is a compact
rounded voice composer, followed by explicit pillar/type/format/status metadata.
The bank shows all four fields beside each title, with mobile records exposing
the same fields rather than hiding them. Both idea scenes occupy one 480px frame.

Small feature films are composed separately from the large interactive demos.
Each uses one complete panel, max-width 355px and height 334px, with 12px interface
copy and a 16–18px hook. Never embed a full script/assistant or publishing workspace
and crop its edges to fit a card. The recording film uses a clean camera view,
small teleprompter copy and recording controls; voice glow belongs on voice input,
not across the camera image. Preserve the original small editing checklist.

### Train pages and pricing

Training uses the shared marketing shell and 1360px container. Exercise pages
start with one back link, a sentence-case 32–48px heading, a short description
and the practice action. No Y eyebrow pills or stacked promotional sections.
Keep the functional practice workspace, then concise steps, benefits and native
FAQ disclosures in the shared type scale. The directory groups drills by daily
skills and real situations, with a single featured random-topic entry.
Train exercise pages close with a Train next step (AI feedback and more
exercises), never the Studio waitlist. Practice prompts and demo labels are
content, not headings: do not mark them up as h2.
All Studio signups reuse WaitlistForm, including its inset input, original action,
fine glow and particles. Keep one concise signup section, without a second
product feature list. Disable particle motion for reduced-motion preferences.

## Credit pricing

Studio and Train have separate pricing pages (/products/studio/pricing and /products/train/pricing); /pricing only chooses between them. Never describe a shared balance. Studio shows its one membership at three billing cadences (weekly, monthly, yearly), each card with the price, the credits that arrive with each payment, and one action. A cost table explains what credits pay for. Train shows free practice beside the one paid plan, which is unlimited AI feedback (never quote a session count), and uses the feedback comparison demo, never Studio imagery. Retain the shared container, graphite surfaces, and fixed card heights when billing or examples change.

### Train product storytelling

The Train product page has its own practice-led visuals; never reuse the Studio creator photo. Its hero contains a working, local one-minute prompt timer. Alternate a three-card exercise gallery, a wide coaching example, an open warm-up routine, and a closing access panel. Keep the shared outer container and type scale. Soft lilac, sage, and peach CSS color fields are intentional backgrounds for these product scenes, as requested; dark ink on pastel fields keeps contrast consistent in both themes. The page canvas remains semantic, with pure black in dark mode. No Neat dependency or watermark. Prompt swaps and answer comparisons reserve space; the timer pauses offscreen and in background tabs and never opens the microphone.

### FAQ controls

Marketing FAQs keep their current content and section layout, with the original compact plus control on the right. Expanding rotates it into a close mark on a contrasting surface and highlights the question in blue. Native disclosure semantics preserve keyboard behavior; answer transitions are progressive enhancement, disabled for reduced motion and keyboard focus.

## Training workspace

`/training` owns mode selection and opens the selected exercise with `?mode=`.
Existing exercise landing pages reuse the same `PracticeStage` console.
Keep prompt selection, duration, and start controls together; duration is never a
separate wizard step. On desktop the prompt occupies the left side and a compact
360px control dock holds the lever, dial, and start action. On mobile the dock
moves below the prompt. Camera preview is an optional separate pane.

The practice console uses 23–28px prompt text, 16–17px reading passages, and
12–14px controls and guidance. Keep the prompt reel at a stable 224px height;
long passages scroll inside it. Preserve the animated mesh in the control dock,
with offscreen and reduced-motion handling. The lever starts a 1.3-second reel
that decelerates onto the actual selected prompt; reduced motion reveals it
immediately. Duration uses a keyboard-accessible dial with 49 uniformly sized
marks, independent of the supported time range, plus a compact preset menu.

## Poster and local project media

Poster opens on real video thumbnails. Keep source selection in a compact,
left-aligned strip within the shared page container, followed by the selected
library. Desktop starts with Made in Yapper; web starts with uploads. Do not add
an intermediate source-selection page or a separate View uploads action.
Use existing system typography, semantic graphite/light surfaces, neutral edges,
13px source names and 11–12px secondary status. Selected sources have both a check
and a stronger neutral outline. No navigation animation. Upload removal uses a
red X with an accessible name, a confirmation and an inline recoverable error.

Editor imports save into their project package in the background. Keep saving
status visible until the live player and saved project use the owned file.
Project storage labels show logical file sizes, not guaranteed physical space
freed: APFS copies can share blocks. Move to Trash is available from project cards
in Editor and Poster; sources travel with the project, and render caches are
removed. Originals outside Yapper remain untouched. Poster-only uploads use the
chosen file directly and do not enter the local project library.

## Recorder configuration

Recorder framing offers Auto (default camera frame), 16:9 and 9:16. Explicit
ratios center-crop both preview and saved media. Preview sizing must leave the
recording transport visible in the Mac window. Configuration scrolls separately;
web controls occupy their own space below the preview at narrow widths.

Use Libraries.dev Gooey selectively for the moving background of discrete
recorder choices. The web uses `liquid-gooey`; SwiftUI draws an equivalent filtered
selection surface in a Canvas. Labels, focus targets and camera content stay
outside that effect. Selection is also exposed through accessibility state.
Pointer transitions last 140–150ms; keyboard changes and Reduce Motion are instant.
Speed and text size remain precise numeric controls on Mac, adjustable during a
take. Rehearsal play, pause and restart work independently of recording.

On Mac, the prompt is a directly movable and resizable reading area. Drag its
body to move; each edge and corner resizes with the opposite edge fixed. Track
the pointer without easing or inertia and persist only the completed gesture.
Store position and dimensions as preview fractions so focus, window resizing
and aspect-ratio changes keep the box reachable without replacing its saved
layout. Keep at least 180×96 points where the preview permits it. The text size
remains independent of the box size. Neutral outlines and handles appear on
hover or keyboard focus; reserve a small grip area above the scrolling text.
Arrow keys move, Shift+arrow keys resize, and the context menu offers the same
operations without dragging. Reset position and size preserves reading settings.

Use Ideas for the content destination, content versions for short-form/long-form/
article drafts, publishing formats for distribution intent, and Project context
for the compact account-context sheet. A planning date does not schedule a post.

### Account and credit indicator

Web and macOS use a single avatar-only account button (44px web hit target,
40px desktop hit target). A 3px circular track surrounds the photo, with a quiet
neutral gap. The menu repeats the avatar at 48px and places the name and plan
beside it. A neutral inset surface holds the exact balance, a thin meter and the
membership action. Do not add a separate credit pill or name to the header.

The arc measures remaining Studio credits against the trial allocation or the
plan's per-payment allocation (including legacy weekly memberships). Top-ups
count toward the balance and values above the allocation clamp to a full ring.
Unknown allocations stay neutral; zero gets an empty track with a small red mark.
Never infer zero from an unavailable billing response. Exact numbers remain
readable and available to screen readers, so color is supplemental.

Use ACL Academy's continuous slider interpolation, reversed for credit health:
coral at 0%, amber at 50%, green at 100%. Light colors: `#d63b3b`, `#b7791f`,
`#0e9f6e`; dark: `#ff6b6b`, `#ffc247`, `#34d399`. The server supplies the same
fraction and colors to both clients. No autonomous AI work is triggered.

### Studio Chirpy

Use the shared floating conversation on every Studio route. Home opens it on
entry without moving keyboard focus; other routes start with it closed. A
manual close lasts until the next route visit. Keep the mascot below the panel
as a persistent toggle, with the same position and glass surface in both states.
Drafts and conversation history survive closing and navigation. The panel has
its own scroll area and fits above the toggle on narrow and short viewports.

Chirpy reacts to real interaction: curious on hover, focus, or a nonempty draft;
a wink on pointer press; talking while working; happy or concerned after a
result. Pointer press feedback is brief and respects reduced motion. Typing
changes the expression without a repeating animation or per-keystroke motion.

Inside Chirpy, use solid contrast buttons: black with white text in light mode,
white with black text in dark mode. Keep glass on the enclosing panel and
mascot toggle only. The message textarea starts at 88px (three rows) and grows
to 220px before scrolling internally.

Home offers eight compact starting points in a two-column grid: cross-posting,
capturing ideas, finding content ideas, organizing Brain knowledge, scripts,
hooks, repurposing, and weekly planning. Each label fills a fuller editable
prompt and focuses the composer; it never sends automatically. Prompts ask for
missing context before planning work. Keep all starters reachable by scrolling
when the composer grows on a short viewport.
