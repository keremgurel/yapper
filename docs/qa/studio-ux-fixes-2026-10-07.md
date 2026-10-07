# Studio UX audit fixes

Scope: the 15 findings from the Mac-first walkthrough on October 7, 2026, with
web parity and narrow-screen checks where relevant.

| Finding                   | Change                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Device state              | Actual capture connections gate recording; setup and retry states are explicit.                                                                                    |
| Teleprompter              | Persistent speed, text size, height, shade and lead-in settings; independent rehearsal controls; live adjustment.                                                  |
| Camera framing            | Auto default, 16:9 and 9:16; real output crop and matching preview; preserve the original with a warning if export fails.                                          |
| Audio-only handoff        | Review identifies audio takes and offers download; incompatible editor handoff is unavailable; import validates before creating a project.                         |
| Key points replace script | Dedicated key-points actions are filtered into an appended bullets block on client and server; existing writing is retained.                                       |
| Transcription audio       | AAC bitrate adapts to lower sample rates, including the failing 22.05 kHz input.                                                                                   |
| Stale media errors        | Background copy results are scoped to their project; navigation clears the previous project's status.                                                              |
| Small windows             | Mac recorder transport remains outside the flexible preview; web canvas actions wrap, idea statuses stack and tablet navigation collapses.                         |
| Accessibility             | Inspector controls and thumbnail navigation have names; selection is exposed; Chirpy has an accessibility action.                                                  |
| Planning date             | Pick date opens a cancellable picker; only confirmation writes; copy distinguishes planning from publication.                                                      |
| Version parity            | Web exposes saved short-form, long-form and article versions, manual editing, generation and selected-version recording/phone handoff.                             |
| Generation feedback       | Cost is visible, native version writing shows elapsed time, stop-waiting preserves prior work, interrupted requests avoid false refund claims.                     |
| Publishing context        | Preview and destination forms scroll independently, captions collapse and the publish action remains beside readiness; export exposes dimensions and next actions. |
| Paused automations        | Availability retry and scheduled-post review are available; saving clearly does not restart the server.                                                            |
| Copy and navigation       | Ideas naming, specific home links, character units, user-facing editor copy, local/cloud storage definitions and Project context naming.                           |

Regression coverage includes center-cropped exported dimensions, preserving a
script while adding key points, and encoding/decoding 16, 22.05 and 24 kHz audio.
No social post or automation was enabled as part of verification.

## Verification results

- Web: 2,071 tests across 285 files; lint, formatting, type checking and production build passed.
- Mac: 1,441 tests across 231 suites passed; signed release packaging succeeds.
- Real Mac capture: 9.48-second portrait take downloaded as H.264 606×1080 with AAC 48 kHz audio.
- Original transcription reproduction: synthetic 22.05 kHz input now produces 45 timed words and 15 caption cards.
- Planning: opening and cancelling the native date picker leaves the idea unplanned.
- Audio-only recording: review offers playback and download without an invalid editor handoff.
- Manual web draft persists through version switching and reload; 320px actions wrap without clipping.
- Recorder controls checked in dark/light appearance and at a 1200×830 Mac window.

Real social publishing, enabling server-paused automations and cross-device phone
redemption were not performed. Verification does not claim exhaustive accessibility
certification or every hardware/permission combination.
