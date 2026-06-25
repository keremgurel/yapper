## 2026-06-24

- Rescued Yapper training IA after Kerem's route correction: kept existing SEO homepage intact, moved active practice tools under /training/random-topic-generator and /training/freestyle-speech, added permanent redirects from old tool URLs, and created honest separate /training pages for fluency, explain-after-reading, read-aloud, interview-prep, dating, and conflict.

- Added PR #23 for canonical /training routing; validation passed with npm run lint, npm run typecheck, and npm run build. Follow-up note: creator-camera-drills was intentionally not included because current product map in data no longer includes it; add when vision is confirmed.

- 2026-06-24 21:24 PDT — Implemented corrected /training architecture: removed coming-soon statuses from training data/nav, kept canonical /training random topic/freestyle redirects, added functional MVP prompt+timer/recorder flows for read-aloud, explain-after-reading, interview prep, dating/social, and conflict handling. Validated with typecheck/lint/build.

- 2026-06-24 21:55 PDT — Polished PR #23 training drill UI toward Kerem's premium/minimal bar: removed public MVP/internal/future copy from /training drill pages, reduced nested card-box layouts in shared drill shells, simplified training hub/entry copy, and preserved random prompt + timer/recording flows. Validation passed with npm run typecheck, npm run lint, and npm run build.
