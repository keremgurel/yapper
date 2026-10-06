# Poster preparation and source flow

## Product behavior

- Web: upload a finished video, reopen an upload, or select a connected platform. There is no editor-project library on web.
- Desktop: the same sources, plus Made in Yapper. This contains one current saved edit per local project, with rendered final thumbnails rather than original takes.
- Editor offers Export. Saved edits prepare locally in the background; opening or publishing shares the same cached render. Preparing the library never uploads project media. An explicit publishing request transfers the selected edit once and retains an owner-scoped revision receipt for reuse.
- Poster renders fit within 1920 pixels on the long edge (1080 × 1920 for vertical video); normal Export keeps full resolution. Captions, effects, cuts, overlays and audio use the same export composition.
- Local uploads preview immediately, become publishable after registration, and transcribe in the background. Uploads remain separate from edited projects.
- Existing Instagram videos import without competing for the legacy recording slot. Deleted storage objects cannot be advertised as reusable masters.
- A frame-picker failure leaves a clear error and retry, never an indefinite thumbnail gate. Custom thumbnails are optional; posting covers use JPEG, while downloads retain PNG.
- Each destination reports its result independently. Post another video returns to the source chooser. In-flight publishing cannot dismiss its review and lose the retry identity.

## Validation evidence

- Web: 2,042 tests across 283 files pass, including ownership, stale-media exclusion, one latest project revision, retention, optional thumbnails, endpoint validation and independent destination completion.
- Native: full 1,427-test run passed. An earlier run exposed an intermittent existing HookPlacement restoration race; isolated and repeated full runs passed. New revision/cover coverage was added afterward and is included in CI.
- PostgreSQL integration and web production build passed on the first PR revision; final checks run on each subsequent revision.
- Browser component fixture: actual source chooser and cover studio, 320/768/1100 px, light/dark. First decoded frame for the 187-second, approximately 47 MB demo: 284 ms over local HTTP. Frame stepping advanced 1.000 to 1.033 seconds. Failed-media state presents retry without a loading spinner.
- Native loader probe: stored 43.667-second video, metadata 718 ms, first frame 1,532 ms total, next frame 465 ms. This is loader timing, not complete publishing latency.
- Actual ep13 project, original full-resolution render: 176.615 s cold, 23.449 ms cached reopen, 20.547 ms cached preview. The 1080p publishing render took 112.242 s cold (36% faster), 31.913 ms cached reopen and 14.256 ms cached preview. Both measured renders preserve the 121.033-second final timeline.
- No public test posts were created. Provider publishing behavior is covered by tests with isolated fixtures; live production UI/import checks follow deployment.
- Installed Mac visual verification was interrupted by the screen lock. A successful test suite does not establish that the new installed UI was visually verified.
