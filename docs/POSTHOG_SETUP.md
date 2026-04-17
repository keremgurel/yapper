# PostHog Analytics — Setup & Dashboard Guide

## 1. Create your PostHog account

1. Go to [posthog.com](https://posthog.com) and sign up (free tier: 1M events/mo, 5K session recordings/mo)
2. Choose **US Cloud** (already configured in your env)
3. Create a project called "Yapper"
4. Copy your **Project API Key** from Project Settings

## 2. Add your key

In `.env.local`:

```
NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

For production (Vercel), add the same env vars in your Vercel project settings.

## 3. Events being tracked

| Event                  | When it fires                             | Key properties                                                                                 |
| ---------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `$pageview`            | Every route change (SPA-aware)            | `$current_url`                                                                                 |
| `topic_generated`      | User pulls the slot lever                 | `category`, `difficulty`                                                                       |
| `filter_changed`       | User changes category/difficulty          | `filter`, `value`                                                                              |
| `session_started`      | User hits Start                           | `mode`, `timerSeconds`, `cameraOn`, `micOn`, `category`, `difficulty`, `topicText`             |
| `session_paused`       | User pauses/resumes                       | `action` (pause/resume)                                                                        |
| `session_completed`    | Timer expires or user hits Finish         | `mode`, `timerSeconds`, `elapsedSeconds`, `finishedEarly`, `cameraOn`, `micOn`, `hadRecording` |
| `session_reset`        | User resets mid-session (abandon)         | `mode`, `elapsedSeconds`, `timerSeconds`                                                       |
| `media_toggle`         | User toggles camera/mic                   | `media`, `enabled`                                                                             |
| `timer_adjusted`       | User changes timer duration               | `seconds`                                                                                      |
| `recording_downloaded` | User downloads recording                  | `hasVideo`                                                                                     |
| `recording_shared`     | User shares via Web Share API             | —                                                                                              |
| `waitlist_submitted`   | Waitlist form submitted                   | `success`                                                                                      |
| `mode_changed`         | User switches Random/Freestyle on landing | `mode`                                                                                         |
| `fullscreen_toggled`   | User enters/exits fullscreen              | `entered`                                                                                      |
| `blog_post_viewed`     | User opens a blog post                    | `slug`, `title`                                                                                |

Plus all **autocaptured** events (clicks, inputs) and **session recordings** are enabled by default.

## 4. Recommended dashboard setup

Once data starts flowing in (give it a day of traffic), create these dashboards in PostHog:

### Dashboard 1: "Yapper — Overview" (check daily)

Create these insights:

**1. Daily Active Users (DAU)**

- Type: Trends
- Event: `$pageview` → Count unique users
- Breakdown: None
- Compare to: Previous period

**2. Sessions Started per Day**

- Type: Trends
- Event: `session_started` → Total count
- Breakdown: `mode` (shows random vs freestyle split)

**3. Session Completion Rate**

- Type: Formula
- A = `session_completed` count
- B = `session_started` count
- Formula: A / B \* 100

**4. Waitlist Conversion Funnel**

- Type: Funnel
- Steps:
  1. `$pageview` (any page)
  2. `waitlist_submitted` where `success` = true
- Breakdown by: `$initial_referring_domain` (shows which traffic sources convert)

**5. Feature Usage (Camera & Mic Adoption)**

- Type: Trends
- Event: `session_started`
- Filter: `cameraOn` = true → Count
- Compare: `session_started` where `micOn` = true → Count
- vs: `session_started` total → Count

### Dashboard 2: "Yapper — Product Deep Dive" (check weekly)

**6. Topic Category Popularity**

- Type: Trends
- Event: `topic_generated`
- Breakdown: `category`
- Display: Bar chart

**7. Timer Duration Distribution**

- Type: Trends
- Event: `session_started`
- Breakdown: `timerSeconds`
- Display: Bar chart
- (Shows what durations people actually use)

**8. Session Completion vs Abandonment**

- Type: Funnel
- Steps:
  1. `session_started`
  2. `session_completed`
- Breakdown: `mode`

**9. Recording Engagement Flow**

- Type: Funnel
- Steps:
  1. `session_completed` where `hadRecording` = true
  2. `recording_downloaded` OR `recording_shared`

**10. Difficulty Level Distribution**

- Type: Trends
- Event: `session_started` (mode = topic only)
- Breakdown: `difficulty`

**11. Average Session Duration**

- Type: Trends
- Event: `session_completed`
- Aggregation: Average of `elapsedSeconds`
- Breakdown: `mode`

**12. Mode Preference Over Time**

- Type: Trends
- Event: `session_started`
- Breakdown: `mode`
- Display: Stacked area

### Dashboard 3: "Yapper — Retention & Growth" (check weekly)

**13. User Retention**

- Type: Retention
- Returning event: `session_started`
- Period: Week

**14. Traffic Sources**

- Type: Trends
- Event: `$pageview`
- Breakdown: `$initial_referring_domain`

**15. New vs Returning Users**

- Type: Trends
- Event: `session_started`
- Breakdown: `$is_first_event` (or use cohorts)

## 5. Session recordings

Session recordings are enabled by default. In PostHog:

1. Go to **Recordings** in the sidebar
2. Filter by specific events (e.g., show only sessions where `session_reset` fired — these are your abandonment cases)
3. Watch a few per week to see where users get confused

## 6. When you add the native app

PostHog has SDKs for:

- **iOS (Swift)**: `pod 'PostHog'` or SPM
- **Android (Kotlin)**: `com.posthog:posthog-android`
- **React Native**: `posthog-react-native`

Use the same project API key — all platforms feed into the same dashboards, same funnels, same user profiles. This is the main reason we chose PostHog over alternatives.

## 7. Environment notes

- PostHog gracefully no-ops if `NEXT_PUBLIC_POSTHOG_KEY` is not set (safe in dev)
- `respect_dnt: true` is enabled — users with Do-Not-Track won't be tracked
- Email inputs in waitlist forms are masked in session recordings
- No PII is stored in event properties (email is only sent via `identify` for waitlist signups)
