<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics for Yapper. Here is a summary of all changes made:

- **`instrumentation-client.ts`** (new): Initialises PostHog using the recommended Next.js 15.3+ approach. Merges all existing config (session recording, autocapture, DNT, persistence) with new options: reverse-proxy `api_host`, `capture_exceptions: true` for Error Tracking, and `defaults: "2026-01-30"`.
- **`next.config.ts`**: Added `/ingest` reverse-proxy rewrites so PostHog requests are routed through Yapper's own domain, improving ad-blocker bypass and data reliability.
- **`src/lib/analytics.ts`**: Removed the manual `initAnalytics()` / `initialized` guard since `instrumentation-client.ts` now handles init. All typed tracking helpers remain intact.
- **`src/components/analytics-provider.tsx`**: Removed the `initAnalytics()` call on mount (no longer needed). Now only handles SPA page-view tracking on route changes.
- **`src/lib/posthog-server.ts`** (new): Singleton `posthog-node` client for server-side event capture in API routes.
- **`src/app/api/waitlist/route.ts`**: On successful waitlist signup, fires a server-side `waitlist_joined` event and calls `posthog.identify()` with the user's email, ensuring server and client events are correlated.
- **`src/hooks/use-timer-editor.ts`**: Added `trackTimerAdjusted` call in `saveTimeDraft` when the user saves a new timer duration.
- **`src/components/blog/blog-explorer.tsx`**: Added `trackBlogPostViewed` on click for both `PostCard` and `FeaturedCard` links.
- **`src/components/ErrorBoundary.tsx`**: Added `posthog.captureException()` in `componentDidCatch` so React rendering errors are automatically sent to PostHog Error Tracking.

| Event                  | Description                                            | File                                    |
| ---------------------- | ------------------------------------------------------ | --------------------------------------- |
| `session_started`      | User starts a practice session                         | `src/contexts/practice-session.tsx`     |
| `session_completed`    | Session finishes (timer done or user hits finish)      | `src/contexts/practice-session.tsx`     |
| `session_reset`        | User abandons a session mid-way                        | `src/contexts/practice-session.tsx`     |
| `session_paused`       | User pauses or resumes a session                       | `src/contexts/practice-session.tsx`     |
| `topic_generated`      | User generates a new random topic                      | `src/hooks/use-topic-generator.ts`      |
| `filter_changed`       | User changes category or difficulty filter             | `src/hooks/use-topic-generator.ts`      |
| `media_toggle`         | User toggles camera or mic                             | `src/contexts/practice-session.tsx`     |
| `timer_adjusted`       | User saves a new timer duration                        | `src/hooks/use-timer-editor.ts`         |
| `recording_downloaded` | User downloads their recording                         | `src/components/CompletionScreen.tsx`   |
| `recording_shared`     | User shares their recording                            | `src/components/CompletionScreen.tsx`   |
| `waitlist_submitted`   | Client-side waitlist form submit (success/fail)        | `src/components/waitlist.tsx`           |
| `waitlist_joined`      | Server-side confirmation of successful waitlist signup | `src/app/api/waitlist/route.ts`         |
| `mode_changed`         | User switches between random topics / freestyle mode   | `src/app/landing-client.tsx`            |
| `blog_post_viewed`     | User clicks a blog post card                           | `src/components/blog/blog-explorer.tsx` |
| `$exception` (auto)    | React rendering errors via ErrorBoundary               | `src/components/ErrorBoundary.tsx`      |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/383795/dashboard/1472707
- **Session start → completion funnel**: https://us.posthog.com/project/383795/insights/KtOWu7Gq
- **Waitlist signups over time**: https://us.posthog.com/project/383795/insights/6qKl7UQZ
- **Sessions by mode (topic vs freestyle)**: https://us.posthog.com/project/383795/insights/RhAOVnv9
- **Recording engagement (downloads & shares)**: https://us.posthog.com/project/383795/insights/sqCxa8dm
- **Topic generator engagement**: https://us.posthog.com/project/383795/insights/pqhXFPMc

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
