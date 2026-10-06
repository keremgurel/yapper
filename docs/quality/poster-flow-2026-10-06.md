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

## Production verification and storage policy

- PR #242 deployed as `34dbabda767d10c1ec3ff8f0d31f9d08cee88e8d`. Final CI passed 2,042 web tests and 1,428 native tests, PostgreSQL integration, web build and native release build.
- Live verification found the R2 bucket allowed `https://ypr.app` but omitted `https://studio.ypr.app`. Its existing CORS policy now also allows the Studio origin, with GET/HEAD/PUT unchanged and Content-Range, Accept-Ranges and Content-Length exposed alongside ETag. Public bucket access remains disabled.
- The formerly stalled Instagram video loaded all 3,631 frames and its 121.033-second duration after that policy change; it was ready at the 5.3-second observation, and the next frame interaction took 289 ms. These are browser-automation observation bounds, not isolated decoder timings.
- A separate uploaded 102.8 MB H.264 video reproduced a browser-cache CORS failure: an HTML video without crossorigin could play, while the frame picker's fetch failed. The same actual frame-picker code succeeded when both used anonymous CORS. Poster thumbnail, preview and TikTok review video elements now use the same mode.
- Full web composition, parallel destination outcomes, same-idempotency retry and post-another reset passed against an isolated API. No public posts were made.
- Available desktop edits are prewarmed locally. Pulse mode took 23.7 s to prepare and 0.9 ms to reopen. The project whose source is on G Micro Pro remains unavailable until that drive returns. Installing and visually checking the new Mac build remains blocked by the screen lock.
