## 2026-06-24

- Rescued Yapper training IA after Kerem's route correction: kept existing SEO homepage intact, moved active practice tools under /training/random-topic-generator and /training/freestyle-speech, added permanent redirects from old tool URLs, and created honest separate /training pages for fluency, explain-after-reading, read-aloud, interview-prep, dating, and conflict.

- Added PR #23 for canonical /training routing; validation passed with npm run lint, npm run typecheck, and npm run build. Follow-up note: creator-camera-drills was intentionally not included because current product map in data no longer includes it; add when vision is confirmed.

- 2026-06-24 21:24 PDT — Implemented corrected /training architecture: removed coming-soon statuses from training data/nav, kept canonical /training random topic/freestyle redirects, added functional MVP prompt+timer/recorder flows for read-aloud, explain-after-reading, interview prep, dating/social, and conflict handling. Validated with typecheck/lint/build.

- 2026-06-24 21:55 PDT — Polished PR #23 training drill UI toward Kerem's premium/minimal bar: removed public MVP/internal/future copy from /training drill pages, reduced nested card-box layouts in shared drill shells, simplified training hub/entry copy, and preserved random prompt + timer/recording flows. Validation passed with npm run typecheck, npm run lint, and npm run build.

- 2026-06-24 22:12 PDT — Re-reviewed PR #23 after polish commit e62b264. Local validation passed with npm run check and npm run build; GitHub checks green. Remaining blocker: /training hub/nav still says only random/freestyle are live and excludes creator-camera-drills from the guided grid despite functional /training/\* pages; left PR review comment with exact fix.

- 2026-06-24 22:24 PDT — Fixed PR #23 Sniff blocker: /training hub and nav now describe all listed training drills as live practice flows, and creator-camera-drills appears in the guided drills grid alongside the other functional canonical drill pages.
