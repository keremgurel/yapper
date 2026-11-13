# Handoff: native Mac design pass

For a Claude session running on a Mac, where the app can be built and seen.
Written November 12, 2026 from a Linux session that could do neither.

## The goal

Kerem wants the whole product to share one premium, ElevenLabs-style look, and
wants the native editor decluttered and aligned without losing any function.
The web half is done on this branch. The native half has its foundation in
place but has never been compiled or looked at.

Branch: `claude/loving-ptolemy-x4y15o` (no PR open yet).
The system is written down in `docs/design-system.md`, sections "Foundation",
"Native Mac app", "Product imagery", "Reveal cards" and "Navigation icons".
Read those first; they override older sections of the same file.

## Step 1: make the native foundation build

Commit `287d7fc` changed these files without a macOS toolchain. They were only
syntax-checked with a Linux Swift compiler, so expect a few type errors.

| File (under `native-macos/Sources/YapperNative`)       | What changed                                                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Design/StudioDesignSystem.swift`                      | Warm surface, line and glass values; new `studioAccent`, `studioAccentForeground`, `studioTextMuted`, `studioTray`; lighter type ramp |
| `Design/StudioButtonStyles.swift`                      | All four styles are pills; primary is solid ink; the `accentCastShadow` helper was removed                                            |
| `Design/StudioMetal.swift`                             | Control fonts semibold to medium. The orange `accent*` functions are now unused: delete them once the build is green                  |
| `Design/StudioIcon.swift`                              | Selected state is ink on a neutral tile, no orange dot                                                                                |
| `Design/StudioNavGlyph.swift`                          | New. Draws the 13 rail glyphs with `Path` on a 20-point grid                                                                          |
| `Views/AppShellView.swift`                             | `StudioSidebar` uses `StudioNavGlyph`, 32pt rows, muted idle labels, no orange marker, ink avatar                                     |
| `Studio/Kit/NativeSegmented.swift`, `NativeChip.swift` | Stone tray with a raised selection; medium labels                                                                                     |

Run, from `native-macos`:

```bash
swift build
swift test          # 1,544 tests passed before this branch
swift run YapperNative
```

Fix whatever does not compile, keeping the intent above. Then look at the app
in light and dark and check:

- The rail glyphs. They were drawn blind. Compare with the web rail at
  `/studio/home`; the SVG source is
  `src/components/studio-shell/studio-nav-icon.tsx`. Redraw any that look off.
- Primary buttons in tight editor toolbars. Pills are 2pt wider per side than
  the old buttons; check nothing clips or wraps.
- The collapsed (66pt) sidebar: glyphs centred, selection pill sensible.
- White-on-white: the primary button is white in dark mode. Look for any label
  that hard-codes `.white` on a primary button.

## Step 2: the editor declutter (the main work)

This is what Kerem actually asked for and none of it is done. His words: the
UI "feels cluttered and not aligning well, especially in the native editor",
fix it "without losing functionality", and the Poster simplification in PR #345
is the model for how to simplify a surface.

What the code looks like today, counted across non-test Swift:

- Font sizes are hard-coded per view: 12pt 238 times, 13pt 166, 11pt 118,
  10pt 33, 9pt 25, plus 10.5, 11.5, 12.5 and 9.5.
- Around twenty different corner radii: 6 (50 uses), 8 (49), 5 (33), 10 (33),
  12 (27), 7 (23), 4, 9, 14 and more.
- 275 files set their own fonts or colours.

Suggested order:

1. Add a small set of named sizes and radii to `StudioDesignSystem.swift`
   (for example text 11/12/13/15 and radii 6/8/12/16) and move views onto
   them, one surface per commit. Fractional sizes go to the nearest step.
2. Go surface by surface with the app open: timeline, inspector, canvas,
   transcript, then the Studio pages (`Studio/Surfaces/*`). For each, take a
   screenshot before and after, align to a shared grid, remove duplicate
   labels and nested borders, and keep every control reachable.
3. Use the web rules for depth: one border per branch, raised objects use a
   hairline and soft shadow, wells are stone with no border.

Rules that must hold:

- **Orange stays on video.** `yapperOrange` is kept for anything drawn over
  footage (playhead, selection and framing boxes, snap guides, about 160
  uses). Do not convert those to ink. It is no longer for buttons or
  navigation.
- **No function is removed.** If a control is moved or merged, the action
  inventory (`docs/native-action-inventory.md`) still has to pass.
- **System font, not Inter.** Bundling Inter needs font registration at
  launch; only do it if Kerem asks.
- Follow `docs/testing.md` for testing and PR steps. Dev test account is
  `the.ypr.app+clerk_test@gmail.com`, code 424242. Never sign in on prod.

## Web items still open

Small, and can be done in the same session since a Mac has `.env.local`:

- Studio web screens (Poster, Ideas, Calendar, Library, Brain) were only seen
  in their "couldn't load" state. With a database, do the same
  screen-by-screen alignment pass there.
- Not yet looked at after the redesign: `/sign-in` and `/sign-up`, the blog,
  feature pages below the fold, the collapsed web sidebar, and the content of
  `/style-guide`, which still describes the old system.
- `src/components/marketing/publisher-preview.tsx` line 90 builds its class
  as `publisher-demo${compact ? "publisher-demo-compact" : ""}` with no space.
  Nothing passes `compact` today, so it is harmless, but it is wrong.
- The reveal card is only on `/features`. The blog index and homepage guides
  shelf are candidates; long article titles need a left-aligned variant.

## Prompt to start the new session

> Check out `claude/loving-ptolemy-x4y15o` in the yapper repo and read
> `docs/handoff-native-design-pass.md` and the Foundation and Native sections
> of `docs/design-system.md`. Do step 1 first: get `native-macos` building and
> its tests passing, then run the app and show me screenshots of the sidebar
> and a few screens in light and dark. Then start step 2 with the editor
> timeline and inspector, one surface per commit, with before and after
> screenshots.
