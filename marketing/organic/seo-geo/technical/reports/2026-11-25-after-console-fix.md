# Technical audit follow-up — Yapper — 2026-11-25 (after console-error fixes)

Lighthouse desktop via DataForSEO `on_page/lighthouse/live/json`, no cache. Compare with the same-day baseline in `snapshots/2026-11-25.json` (best practices 77).

Two post-fix runs:

1. After marketing Access Studio CTAs pointed at `studio.ypr.app` and `duration-[var(--sg-dur-base)]` shipped (plus the header CTA follow-up). Instant Pages included. Billed $0.0056. Snapshot: `snapshots/2026-11-25-after-console-fix.json`.
2. After Clerk `signInFallbackRedirectUrl` / `signUpFallbackRedirectUrl` also used `studioEntryHref()` (SHA `17511e57`). Lighthouse only, billed $0.005.

## Homepage Lighthouse before vs after

URL: https://ypr.app/

| Category       | Before | After CTAs + CSS | After Clerk fallback too |
| -------------- | -----: | ---------------: | -----------------------: |
| Performance    |     98 |               98 |                       98 |
| Accessibility  |    100 |              100 |                      100 |
| Best practices |     77 |               96 |                       96 |
| SEO            |    100 |              100 |                      100 |

### Failed audits

| Audit                                     | Before                                                                                   | After CTAs + CSS                                                            | After Clerk fallback too                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser errors were logged to the console | Fail (CORS prefetch of `/studio/home` + `ERR_FAILED`, plus `:--sg-dur-base` deprecation) | Fail (one remaining CORS RSC prefetch of `/studio/home`). Deprecation gone. | Fail (same residual CORS RSC prefetch of `https://ypr.app/studio/home?_rsc=…` still redirected to `studio.ypr.app`). Deprecation still gone. |
| Uses deprecated APIs                      | Fail (1 warning: `CSSCustomStateDeprecatedSyntax` / `:--sg-dur-base`)                    | Pass (score 1, 0 items)                                                     | Pass (score 1, 0 items)                                                                                                                      |
| Back/forward cache                        | Fail (2 reasons)                                                                         | Fail (2 reasons)                                                            | Fail (2 reasons), unchanged                                                                                                                  |
| Network dependency tree                   | Fail                                                                                     | Fail                                                                        | Fail, unchanged                                                                                                                              |
| Forced reflow                             | —                                                                                        | Fail (lab-only; not in the 77-score diagnosis)                              | Not reported                                                                                                                                 |

The 77 → 96 jump is the deprecation leaving the report, plus fewer console errors. Visible marketing CTAs and Clerk fallback URLs are now `https://studio.ypr.app/studio/home` on the live homepage (verified 25 Nov 2026, America/Vancouver). The residual lab CORS looks like a Next.js RSC prefetch of the relative `/studio/home` path; `AppChrome`'s route prefetch is gated to the desktop app and was left alone so Mac behaviour stays unchanged.

Mac app routing (`YapperStudioNative/` user agent, `/studio/native-auth`, `/studio/handoff`) was not changed.
