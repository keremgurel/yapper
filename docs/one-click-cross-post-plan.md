# One-click cross-post

Turn a finished edit into a post on YouTube, TikTok, and Instagram from the
editor's "1 click post" section. The user connects each platform once (OAuth);
after that, posting is one button.

This is the `docs/product-vision.md` "one-click cross-post (later)" item.

## The honest shape

"One click, fully automatic, public" is only true for YouTube. The other two
put a wall in the way, so the feature is sold as "post everywhere" with
per-platform honesty about what "post" means:

| Platform  | What "post" means (MVP)                                                | Gate                                                       |
| --------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| YouTube   | True one-click public Short.                                           | Google OAuth consent-screen verification.                  |
| TikTok    | One click to the user's **drafts/inbox**; they tap publish in the app. | Direct public post needs TikTok app audit (later upgrade). |
| Instagram | One click for **Business/Creator** accounts only.                      | Meta app review; personal accounts can't publish via API.  |

## Two architectural facts this forces

1. **The rendered video must leave the browser.** Instagram fetches the file
   from a public HTTPS URL; it's the clean path for the others too. So at
   publish time the export blob goes browser → R2 → platform. Export-to-file
   stays local; only opting into a post uploads. This is the one departure from
   "nothing is uploaded," and it is scoped to the publish action.
2. **We hold users' platform refresh tokens server-side.** Encrypted at rest,
   refreshed on demand. That is a security responsibility, not just plumbing.

## Reusing what exists

- `exportTimeline()` already returns the MP4 `Blob`. Publish is a sibling of the
  existing download path, same blob, different destination.
- R2 presign upload + ownership-namespaced keys: `src/lib/r2.ts`.
- Authed API routes: `const { userId } = await auth()`; unconfigured subsystems
  return **501** (`r2Configured` / `place-overlays` pattern).
- `content_items.status` already has `posted` to flip on success.
- Onboarding already has platform icons: `src/components/onboarding/platforms.tsx`.

## Data model (two new tables)

- **`platform_connections`** — one per (user, platform). Encrypted access and
  refresh tokens, scope, `expiresAt`, external account id/handle, status.
- **`publish_jobs`** — one per (video, platform). Status
  `queued → uploading → processing → published | failed`, the R2 `mediaKey`
  being posted, caption/title, external post id + url, error.

## Build slices (each its own verifiable increment; all gated behind env config)

1. **Data foundation** (no external credentials needed) — the two tables +
   migration, and a pure, tested **platform capability registry** (the table
   above as code: mode, scopes, constraints). ← this commit
2. **OAuth connect flow** — `connect/[platform]` redirect + `callback` token
   exchange, a generic OAuth2 helper, and AES-GCM token crypto (`tokens.ts`,
   tested). 501 when a platform's env is unset. Functional once Google creds
   are provisioned.
3. **Publish pipeline, YouTube first** — export → R2 presign PUT → `POST
/api/publish` creates jobs → server-side YouTube resumable upload → status
   route. Proves the whole pipeline end to end on the easy platform.
4. **The "1 click post" UI** — connect states, the post button, per-platform
   progress. Lives in the editor next to Export.
5. **TikTok (draft-inbox) + Instagram (business, public-URL)** plug into the
   same pipeline.

## Credentials the user must provision (env)

Each platform is a separate developer app with its own review/verification and
its own client id/secret. Code returns 501 until these are set, so slices land
and pass CI without them.

- `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` (Google Cloud, OAuth consent
  screen verified, `youtube.upload` scope).
- `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` (TikTok for Developers,
  Content Posting API).
- `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` (Meta app, `instagram_content_publish`).
- `PUBLISH_TOKEN_KEY` — 32-byte key for encrypting stored platform tokens.

The long pole is review lead time (weeks), not the code.
