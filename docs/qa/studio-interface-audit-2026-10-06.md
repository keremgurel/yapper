# Studio interface audit — October 6, 2026

**Scope.** Studio's shared UI and all twelve sidebar destinations: Home, Brain,
Ideas, Recorder, Editor, Poster, Calendar, Automations, Brand, Storage,
Dictionary, and Connections. Read `docs/design-system.md` and
`docs/studio-design-language.md` before changing the existing system. This pass
addresses layout, status labels, typography and control affordances; it does
not certify every product workflow or provider integration.

**Coverage.**

| Area          | Evidence inspected                                                                                                           | Result                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Web desktop   | Authenticated Studio pages; shared-component and complete Poster fixtures at 1280px                                          | Shared alignment and status issues fixed                              |
| Web mobile    | Studio routes at 320px; actual changed components at 320px and 768px                                                         | Header, action, account and calendar overflow fixed                   |
| Themes        | Actual changed components in light and dark themes                                                                           | Status labels and controls remain legible                             |
| Accessibility | Browser accessibility tree, account menu Escape/focus return, view selection, hashtag removal, named compact header controls | Focus and accessible-name improvements verified                       |
| Native Mac    | Installed app's Poster, Home and Connections; native chip source                                                             | Native badges use a separate horizontal stack; no native code changed |
| Motion        | Source review of shared buttons and status spinner                                                                           | Restricted button transitions; reduced-motion override retained       |

**Findings.**

| Severity | Area          | Location                                                                                      | Before                                                                                    | After                                                                               | Why                                                           |
| -------- | ------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| HIGH     | Layout        | `studio-shell/studio-header.tsx`, `ui/sidebar.tsx`                                            | Account controls extended beyond a 320px viewport                                         | `min-w-0`, named 32px compact controls, shared content frame                        | Every Studio route retains reachable header actions           |
| HIGH     | Layout        | `publish/connections-panel.tsx`                                                               | Account names squeezed behind status/actions                                              | Two-column mobile grid; actions on the next row; three columns from `sm`            | Identities and controls remain readable                       |
| HIGH     | Layout        | `calendar/calendar-header.tsx`, `brain/brain-tabs.tsx`                                        | Month navigation or final tab clipped at narrow widths                                    | Wrapping controls and tabs, no fixed month minimum width                            | All sections and calendar navigation remain reachable         |
| HIGH     | Accessibility | `account/user-menu.tsx`, `project/project-brain-button.tsx`, Calendar and Dictionary controls | Unnamed compact buttons or absent explicit focus styling                                  | Accessible names and `focus-visible:ring-2`                                         | Keyboard and assistive-technology users can identify controls |
| MEDIUM   | Status        | `studio-ui/chip.tsx`, `publish/poster/destination-card.tsx`                                   | Block SVG inside truncating text stacked above Ready                                      | Separate `icon` and `endAdornment` slots; 24px minimum height and single-line label | Corrects the reported badge and prevents recurrence           |
| MEDIUM   | Layout        | `studio-ui/page-header.tsx`, `toolbar.tsx`, `workbench/section.tsx`                           | Long metadata or action groups pushed outside their container                             | Wrapping groups with `min-w-0 max-w-full` where needed                              | Fix applies across pages, including Ideas actions             |
| MEDIUM   | Layout        | `studio-home/channels-section.tsx`                                                            | Account, counts and status competed for one row                                           | Full-width identity followed by metrics and status                                  | Long handles remain readable in dashboard columns             |
| MEDIUM   | Interaction   | `publish/captions/hashtag-chips.tsx`                                                          | Remove icon inside truncated label; tiny target                                           | Separate 24px removal button and visible input focus                                | Long tags cannot hide their removal control                   |
| MEDIUM   | Status        | `publish/connections-panel.tsx`                                                               | Reconnect required displayed with a green check                                           | Warning icon and yellow text mixed with the theme's text color                      | State is no longer presented as success                       |
| LOW      | Consistency   | Poster toggles, Dictionary, shared Section and StatBlock                                      | Uneven three-plus-one destination grid, misaligned optional label, uppercase micro-labels | Two-column destination grid, one label row, sentence-case labels                    | Matches the user's design system and improves scan order      |

**Verification.** `npm run check` passed: lint, formatting, TypeScript, and
2,058 tests across 284 test files. Browser fixtures exercised the real shared
components and Poster with synthetic accounts and media; no public posts were
created. At 320px, both the component review and prepared Poster measured
`documentElement.scrollWidth === innerWidth`. Ready, warning and scheduled
chips measured 24px tall with icons centered beside the text. Menu dismissal
returned focus to the account trigger with its visible focus ring. Calendar
view selection and long hashtag removal worked.

Screenshots were saved locally under `/tmp/yapper-ui-audit/`, including
`components-after-320-dark.png`, `components-after-320-light.png`,
`components-after-768-light.png`, `components-after-1280-light.png`,
`poster-after-1280-dark.png`, and `poster-after-320-dark.png`.

Not verified: Lighthouse (not exposed by the connected browser tooling), full
screen-reader operation, forced colors, OS contrast preferences, 200% browser
zoom, native window resizing and every native route. Reduced-motion styling
was reviewed in source rather than emulated. Live posting, recording, billing,
OAuth and destructive actions were not triggered during this visual audit.

**Strengths.** Preserve the semantic theme tokens, shared page frame, explicit
publishing status labels, and separate source choices in Poster.

**Highest-leverage change.** Repairing Chip's structure fixes icon/text alignment
centrally; compact header sizing removes overflow across all Studio pages.

**Verdict.** Approve the verified web layout fixes. The unverified checks above
remain outside this pass's approval.
