# Yapper Studio completion audit

Date: 2026-09-05. This is the working checklist for the Studio completion
goal. Findings below come from the current local source, including existing
uncommitted work. A working screen is not proof that its whole workflow works.
External account configuration and native release verification remain separate
from automated source checks.

## Current status

The largest missing features now have implementations: conversational brand
kits, a durable publishing queue, persistent Instagram repurposing rules, and
recording handoff into the native editor. The goal remains unfinished. Live worker
configuration, deployed migrations, provider outcomes, and installed-app testing
are still release gates. No live post, production migration, or worker enablement
has been performed by this task.

## Confirmed gaps and acceptance criteria

- [ ] **P0 — Conversational brand kit.** `studio-chirpy.tsx` has no brand
      action; color instructions fall through to chat or generic Knowledge capture.
      Connect explicit color instructions to the real brand API, show the resulting
      palette, open the kit, and synchronize an already-open Brand screen. Support
      setting, adding, removing, and choosing a primary color. Preserve logos and
      reject ambiguous/invalid colors without silently dropping user input. Saving
      must succeed before Chirpy claims completion. Verify reload and scene use.
      **Implemented:** exact CSS names and short/full hex, explicit set/add/remove/
      primary/show commands, shared API/cache, inline swatches, navigation, and
      native Studio/editor routing. Browser setup, reload, Home → Brand, invalid
      input, primary change, add, and removal verified. Native binary builds and
      command tests pass; a rebuilt native app interaction and generated-scene
      check remain pending. Arbitrary prose outside recognized commands still
      falls back to coaching; broaden language understanding in the Chirpy work.
- [ ] **P0 — Durable automations.** `automations-view.tsx` stores every setting
      only in component state, despite promising that configuration is retained.
      No automation API, database model, or runner exists. Build persisted rules,
      enable/disable, source polling, source-file readiness, destination checks,
      per-post idempotency, retries, and visible run history. Verify that settings
      survive reload and one source post creates at most one post per destination.
      Do not enable automatic publication while merely previewing its setup.
      **Implemented:** versioned saved rules, reviewed account identities,
      enable/pause, durable paginated source scanning with no historical
      backfill, unique source events, shared import and publishing paths,
      immutable run snapshots, retries, and visible destination outcomes.
      Pausing cancels waiting deliveries and prevents delayed imports from
      queuing more work. Isolated PostgreSQL tests cover persistence, replay,
      expired leases, pause races, account ownership, and atomic enqueue.
      Protected worker authentication and disabled-state behavior are tested.
      Signed-in disabled/setup-unavailable state is honest and usable. Enabled
      staging workflow and multi-worker contention remain release checks;
      prerequisites are in `docs/studio-automations.md`.
- [ ] **P0 — Scheduled publishing.** Calendar and content records store
      `scheduledFor`, but nothing consumes due items; the only deployed cron is
      storage cleanup. Add durable publishing schedules with destination/caption
      snapshots, a due-job runner, timezone-aware controls, cancellation/reschedule,
      retry and failure reporting, and actual outcome reconciliation. A date on a
      library item must not imply that publication is armed.
      **Implemented:** reviewed per-destination schedules, account/copy/cover
      snapshots, timezone controls, cancel/reschedule/retry, a protected due
      worker, durable claims/leases, lost-response replay, and delayed-result
      reconciliation. Token refresh also protects concurrent account changes.
      All migrations applied successfully in isolated PostgreSQL tests. Queue
      tests cover recovery, ownership, cancellation, retention, and duplicate
      prevention; live publication and staging worker contention remain checks.
      Deployment prerequisites are in `docs/scheduled-publishing.md`. The flag
      remains off, and no production migration or live post has been made.
- [ ] **P0 — Browser → native editor handoff.** `desktop-editor-gate.tsx` opens
      `yapper-studio://open/editor` without the selected library item. Native
      `onOpenURL` handles project files and passes every other URL to
      `NativeAuthHandoff.receive`, which only accepts `auth/callback`. Add an
      explicit editor-open handler that preserves item/media context, reports
      missing media, and opens the selected recording. Verify starting from a
      Library item and from a saved Recorder take.
      **Implemented:** Library, workbench, and saved-take links carry the item;
      browser deep links and embedded navigation reach the same Mac handler.
      Account-owned recordings download into a persistent project with cancel/
      retry, existing edits reopen for the same take, and sources survive rename
      and copy. Native synthetic-video and ownership/identity tests pass. Recorder
      now prefers MP4 where supported. Installed-app interaction and older WebM
      compatibility remain release checks; the running app has not been replaced.
- [ ] **P1 — Chirpy actions throughout Studio.** Voice/audience and Knowledge
      edits require Brain's page-mounted tool registration. They claim success
      before autosave finishes. Make actions work from every Studio page, match
      Knowledge unambiguously, await durable writes, and reflect failures accurately.
      The generic coach must never claim to have performed unsupported actions.
      Remove or implement the advertised `@` reference behavior in web chat.
      **Implemented:** actions use awaited server writes on every Studio page;
      mounted Brain edits use its serialized save queue. Exact Knowledge names
      win and ambiguous partial matches are rejected. Removed the unimplemented
      web mention hint, prevented duplicate sends, and made uncertain-save replies
      honest. Signed-in Home → voice update → Brain and reload passed. Further
      conversational variations and UI network-failure injection remain checks.
- [ ] **P1 — Brand editor recovery and consistency.** An initial fetch failure
      leaves permanent loading UI with no retry; Upload remains enabled before a
      kit loads. Add recoverable loading/error states, consistent color validation,
      a genuinely new Add Color value, and synchronization with Chirpy. The current
      brand API silently removes invalid colors, potentially clearing the palette.
      **Implemented:** shared kit state, retry on load failure, disabled uploads
      before load, whole-palette validation, eight distinct Add Color choices,
      and keeping the last saved swatch visible if a write fails. Failure-state
      browser verification remains pending; rejection paths have automated tests.
- [ ] **P1 — Brain persistence and recovery.** `useBrainBlocks` turns load
      failures into empty Knowledge, optimistically removes records without rollback,
      and queues per-block patches with a shallow merge that can discard earlier
      fields. Project save responses can overwrite newer local edits. Preserve
      unsaved edits, serialize writes, provide retry, and verify rapid edits and
      failed mutations. Share the same persistence path with Chirpy.
      **Implemented:** serialized writes with nested patch merging, retained
      failed changes, explicit retry, protection against stale save/reload replies,
      and awaited delete/reset/reorder outcomes. Load failures no longer become
      empty Knowledge or Skills. Project API also rejects a disappeared row
      instead of reporting the old value as saved. Queue outcome/failure tests
      pass; signed-in voice/audience save, reload, and clear passed, and test
      values were restored to their original empty strings.
- [ ] **P1 — Calendar error recovery.** The calendar ignores `loadFailed` and
      spins forever on failed initial loads. Drag reschedule errors silently roll
      back; overlapping drags can restore stale dates. Surface errors and retries,
      and make rapid rescheduling deterministic.
      **Implemented:** retryable load failures, per-item save errors and retries,
      serialized date writes, and rollback to the last confirmed date. Race and
      failure tests pass. UI states clearly that calendar dates alone do not
      trigger publication. Empty-calendar browser check passed; drag UI check
      with real scheduled items remains pending.
- [x] **P1 — Cross-surface cache freshness.** Shared cache mutation does not
      supersede older in-flight reads. A successful write can be overwritten in the
      UI by stale fetch output. Verify mutation during fetch and account switching,
      then use the corrected mechanism for brand and other shared resources.
      **Completed:** a mutation advances the cache generation and supersedes older
      reads. Regression tests verify stale-read protection and existing account
      clearing behavior. Brand uses the shared resource and updated live in Chrome.
- [ ] **P0 — Idea capture data loss.** The composer clears its draft before
      awaiting creation, leaving failed requests without the original thought.
      Draft restoration can also erase saved text during a repeated mount.
      **Implemented:** await confirmed save before clearing, retain draft on
      failure, prevent duplicate clicks, disable edits during submission, and
      offer retry. Restore local drafts before writing storage; unavailable
      browser storage no longer crashes capture. Bank load errors and detail
      errors have retries; previews refresh after completed analysis. Browser
      capture/reload and failure checks remain pending.
- [ ] **P1 — Library save and action recovery.** Load failures masquerade as
      missing content, opening Recorder can outrun the final script save, bulk
      errors escape the UI, and overlapping status edits can roll back newer
      work. **Implemented:** separate missing/load failures, save and action
      errors with retries, await saves before Recorder/Editor/Poster/phone
      handoffs, serialize status/date changes, refresh shared lists after saves,
      and preserve bulk selection when the server only applies part of an
      action. Queue rollback/retry tests pass. Full browser handoff remains open.
- [ ] **P1 — Honest Home and connection states.** Video-load failures become
      disconnected channels/zero performance; Home checks the wrong active
      connection status; disconnect failures and malformed OAuth query values
      are mishandled. **Implemented:** preserve fetch failures, display unknown
      metrics and channel errors, offer reload, use actual active status, await
      disconnects, and ignore unknown callback platforms. Home and malformed
      callback browser checks pass; provider failure/reconnect tests remain.
- [ ] **P1 — Dictionary recovery.** Failed alias changes discard input and
      deletion/save rejections lack usable feedback. **Implemented:** retain
      failed edits, await mutations, provide retry, distinguish load failures,
      and use an inline removal confirmation with recoverable errors. Browser
      add, edit, and reload passed. The old browser confirmation blocked browser
      automation; the single test entry was removed through a narrowly scoped
      database cleanup. Verifying the new inline removal UI remains pending.

## Surface-by-surface verification queue

| Surface         | Source evidence / current state                                          | Required verification                                                                        |
| --------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Home            | Real data, honest partial failures, active connection detection          | Provider failure display; refresh after edits/posts                                          |
| Brain           | Real project, Knowledge, skills, and AI APIs                             | Save/recovery work above; context reaches each generation surface                            |
| Idea bank       | Durable capture with retained drafts, load and analysis retries          | Typed/link/voice capture, original transcript retention, multi-select to Library             |
| Content Library | Persisted workbench, serialized status changes, save-before-navigation   | Browser rapid autosave, script-to-recorder handoff, delete/bulk failure recovery             |
| Recorder        | Recorder and save-take/upload/submission paths exist                     | Permissions, device switching, take recovery, save and reopen linked item                    |
| Editor          | Web deliberately opens the native Mac editor                             | Native project/media handoff, edit persistence, playback/export and return to Poster         |
| Poster          | Real multi-platform publishing/import/caption/cover code and tests       | Master-file readiness, partial success, retries without duplicates, actual live/draft result |
| Calendar        | Persisted date planner plus separate reviewed publishing queue           | Scheduling and recovery work above                                                           |
| Automations     | Persisted rules, source scanning, imports, queued deliveries and history | Enabled staging execution and pause/reconnect races                                          |
| Brand           | Persistent ordered colors, logo uploads, primary logo, scene integration | Conversational setup, synchronization, reload, failure handling                              |
| Storage         | Real quota and usage breakdown with management links                     | Deletion frees the correct storage; reservations and shared assets remain consistent         |
| Dictionary      | Persistent vocabulary, retained failed edits, inline delete/retry        | Inline removal UI, transcription use, failure UI                                             |
| Connections     | Real OAuth, account status, visible load/disconnect failures             | Configured accounts connect/refresh/disconnect                                               |

## Definition of complete

Every listed gap is implemented and checked. Each existing surface has a
working persisted path, loading/empty/error/retry behavior, and verified
handoffs. Tests exercise outcomes and failure boundaries; lint and type checks
pass. Signed-in browser and native checks are recorded with their actual
results. Live publishing, billing, platform review, and release dependencies
must be explicitly recorded if they cannot be verified in this environment.
New product areas such as Windows, mobile capture, and browser extensions are
not silently added to the definition of completing the existing Studio.

## Validation log

- Baseline: TypeScript check passed; 194 test files / 1,452 tests passed.
- Existing uncommitted native overlay and Poster work was present before this
  audit; preserve it and avoid claiming it as changes from this task.
- Current web suite: 196 files / 1,496 tests passed; repository lint and
  TypeScript checks passed. Focused brand/cache tests: 48 passed.
- Native: `swift test --filter AssistantRouterTests` built successfully and
  passed 20 command tests. A pre-existing unused-result warning remains in
  `EditorSession.deleteSelected`. The running/released app has not been replaced.
- Signed-in Chrome against the existing local server at localhost:3111:
  conversational palette setup, immediate Brand refresh, reload persistence,
  opening Brand through Chirpy from Home, invalid-color clarification without
  a partial save, primary ordering, adding a named color, and removal passed.
  The test began with an empty kit and restored that empty kit afterward.
- The in-app browser was signed out; Chrome already had an authorized local
  session. No authentication bypass or new test account was used.
- Full native interaction, generated-scene/live provider, OAuth, actual
  publication and billing verification remain pending. Automations and due-job
  publishing were not implemented or enabled by the first slice.
- Continuation: full web suite passed 199 files / 1,515 tests, followed by two
  added Project persistence tests passing in the focused run. TypeScript and
  lint passed. Save, calendar, matching, handoff, and recording-format checks
  passed 27 focused tests.
- Continuation native check: 69 tests across 8 suites passed, including an
  actual generated movie installed into a project, reopened, renamed, copied,
  and read after the original package was removed. No account-owned media was
  changed by native tests. Browser handoff page shows the selected-recording
  action and same-account instructions. Full installed-app handoff remains open.

- Scheduled publishing continuation: full web suite passed 206 files / 1,562
  tests; lint and TypeScript checks passed. Queue validation includes actual
  isolated PostgreSQL migrations and SQL outcomes, without using the deployment
  database. Signed-in Calendar loads normally with scheduling disabled. Poster
  has no saved source in this account, so its full schedule sheet and actual
  provider result still require a controlled staging video.
- Automation continuation: full web suite passed 211 files / 1,591 tests;
  lint and TypeScript checks passed. Both new migrations passed in isolated
  PostgreSQL. Signed-in Automations shows unavailable setup clearly with
  worker flags off and the deployed migration absent.
- Latest recovery continuation: full web suite passed 212 files / 1,603 tests;
  lint and TypeScript checks passed. Checks include conversational variations,
  failed platform loading, library status/date rollback and retry, and protected
  automation worker authorization. Dictionary add, rename, and reload passed.
  The single temporary `ChirpyVerificationEdited` entry was removed using its
  exact term, alias, and creation window; no original dictionary entries were
  present. The old Chrome confirmation blocked further browser actions.
- Production compilation passed using `next build` directly. This bypassed
  the repository's deployment script that applies production migrations;
  no production migration was run. Final dictionary UI changes also passed
  lint and TypeScript checks.

## Remaining release and capacity checks

- Apply and verify the two new migrations in staging; configure both protected
  workers and run duplicate/timeout/account-change cases with controlled media
  and connected accounts before enabling production. Current signed-in local
  account has no connected channels or saved publishing source.
- Run the installed Mac app through Library/Recorder → Editor, edit/save/reopen,
  export → Poster, and brand-driven scene creation; check older WebM recordings.
- Complete browser capture → Library → script → Recorder and Storage checks,
  including failure recovery. Verify voice/device permissions with the user’s
  devices when available.
- Scheduling currently lists 100 recent/actionable deliveries, automation
  activity lists 50 source videos, and source polling is bounded per invocation.
  Pagination and throughput expansion remain follow-ups for larger workspaces;
  the UI and deployment docs must describe the current limits accurately.
