# Cross-post: post everywhere, from one place

Yapper becomes the place you post from. Make a video (in the editor), or point at
one you already have, and push it to YouTube, TikTok, and Instagram with captions
written in your own voice, per platform. See everything you have across all three
in one grid, and fill the gaps in a click.

This is the `docs/product-vision.md` "one-click cross-post" item, expanded.

## What we're building

1. **Per-platform captions, AI-drafted in your voice.** At post time, generate a
   caption for each target platform, styled from your own past captions on that
   platform, then edit it inline before posting. YouTube's shape is different
   (title + description + tags); TikTok/Instagram are caption + hashtags.
2. **A content matrix.** One grid of everything you've posted, rows = videos,
   columns = platforms, each cell clearly showing posted (thumbnail + link) or a
   gap. Click a gap (or a "cross-post" action) to post that video to the missing
   platforms.
3. **One export, many destinations.** The rendered video is uploaded once and
   posted to N platforms from that single copy. No re-export per platform.

## The crux: where the video bytes come from

Cross-posting = putting the same file on several platforms, so the whole design
turns on one question: do we have the file?

- **Yapper-made content** — the editor produces the MP4. We persist it (R2) and
  can post it anywhere, anytime. This is the clean core; it always works.
- **Your back catalog** — Instagram and TikTok let us _read_ that a video exists
  (to show it in the matrix) but will **not** hand back the original file to
  re-upload elsewhere. So the matrix can always _show_ a gap; "post here" is
  enabled when a master file exists (Yapper made it, or you upload the original)
  and otherwise offers "add the original to post." We never pretend to pull a
  video off Instagram.

Everything below is designed around that truth.

## The honest per-platform shape

"One click, fully automatic, public" is only fully true for YouTube.

| Platform  | "Post" means (MVP)                                   | Gate                                                   |
| --------- | ---------------------------------------------------- | ------------------------------------------------------ |
| YouTube   | Public Short (title + description + tags).           | Google OAuth consent-screen verification.              |
| TikTok    | Lands in your TikTok drafts; you tap publish in-app. | Public direct-post needs TikTok's app audit (later).   |
| Instagram | Reel, **Business/Creator accounts only**.            | Meta app review; personal accounts can't post via API. |
| (listing) | Reading your existing posts for the matrix.          | Same scopes/verification; IG listing is business-only. |

## Data model

Building on the merged foundation (`platform_connections`, `publish_jobs`,
`src/lib/publish/platforms.ts`):

- **`content_items`** (exists) stays the spine. Its linked `submission`
  (`submissionId` → `submissions.mediaKey`) is the **master video** in R2. On
  export we persist the MP4 as a submission and link it, reusing the proven
  `use-save-take` upload pattern (presign PUT → `POST /api/submissions` →
  PATCH `submissionId`). No exported blob is download-only anymore.
- **`platform_posts`** (new) — the durable "this content is live on this
  platform" record, distinct from the transient `publish_jobs` (upload attempt):
  `contentItemId`, `platform`, `externalPostId`, `externalUrl`, `payload` (jsonb:
  the per-platform caption shape actually posted), `thumbnailUrl`, `postedAt`,
  `origin` (`yapper` | `imported`). One row per (content, platform). This powers
  the matrix and is the corpus of "your past captions" for style.
- On a `publish_jobs` success → upsert a `platform_posts` row. Imported posts
  create `platform_posts` directly (no job).

## Per-platform caption shape (a discriminated union)

```ts
type CaptionPayload =
  | { platform: "youtube"; title: string; description: string; tags: string[] }
  | { platform: "tiktok"; caption: string; hashtags: string[] }
  | { platform: "instagram"; caption: string; hashtags: string[] };
```

Validated to each platform's limits (YouTube title ≤ 100, description ≤ 5000;
TikTok/IG caption ≤ 2200), in the editor and again server-side before posting.

## Caption generation (in your voice)

New route `POST /api/publish/caption`, mirroring `src/lib/generate/idea.ts`
exactly (lib/route split, Surplus gateway, `gpt-5.4-mini`, strict JSON, charge
on success). Input: the video's transcript/script, the target platform, and a
sample of your recent `platform_posts` captions for THAT platform as style
exemplars (few-shot). Output: the platform's `CaptionPayload`. Editable before
posting. Generated per platform, in parallel.

## The matrix and import

- **Import**: for each connected platform, pull your video list (YouTube
  `search.list mine` / IG `GET /{ig-user}/media` / TikTok `video.list`) into
  `platform_posts` (`origin: imported`), refreshed on a cadence, not per view.
- **Matching** cross-platform is the fuzzy part — the same video has no shared id
  across platforms. Yapper-posted content is linked exactly (we know the map).
  Imported posts are matched conservatively (duration ±1s + publish-date window +
  caption similarity); only high-confidence matches merge into one content row,
  the rest stay separate and you can merge them. We never wrong-merge (that
  corrupts the grid). This heuristic is imperfect by nature and is called out as
  such in the UI.
- **Matrix UI**: extends the Content Library (`src/components/library/`). Rows are
  content items; platform columns show posted/gap with the platform badge; a gap
  is a click-to-cross-post target.

## Cross-post flow

From a content item (matrix cell or its detail): pick target platforms → each
gets a caption editor pre-filled with the AI draft (editable) → Post → creates
`publish_jobs` → server posts (R2 → platform) → per-platform live progress → on
success the `platform_posts` row lands and the matrix cell fills.

## Build slices (sequenced; each verifiable, gated to 501 until configured)

Slice 1 (**merged foundation**): schema (`platform_connections`, `publish_jobs`)

- capability registry.

1. **OAuth connect** — `connect/[platform]` + `callback`, a generic OAuth2 helper,
   AES-GCM token crypto (`tokens.ts`, tested). Connect a YouTube account.
2. **Master media** — "Save to post" on export: MP4 → R2 → submission → linked to
   a content item (reuse `use-save-take`).
3. **Publish pipeline, YouTube first** — R2 → resumable upload → `publish_jobs` →
   `platform_posts` → status route. Proves the whole pipeline end to end.
4. **Captions** — `CaptionPayload` schema + `/api/publish/caption` (style-influenced)
   - the per-platform caption editor.
5. **Cross-post flow UI** — pick platforms → edit captions → post → progress.
6. **Matrix + import** — pull platform lists → `platform_posts` → matching →
   the unified grid with badges and gaps.
7. **TikTok (draft-inbox) + Instagram (business)** — plug into the pipeline.

Slices 1–5 deliver "make it in Yapper, cross-post everywhere with captions in
your voice." 6 adds the back-catalog matrix. 7 broadens platforms.

## Efficiency (the 10x)

One export → one R2 upload → posted to every platform from that copy. Captions
generated per platform in parallel. The matrix reads from cached `platform_posts`
with a background refresh, never blocking on live platform calls.

## Credentials the user must provision (env; code is 501 until set)

Separate developer app per platform, each with its own review/verification:

- `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` (Google, verified consent screen).
- `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` (TikTok for Developers).
- `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` (Meta app, `instagram_content_publish`).
- `PUBLISH_TOKEN_KEY` — 32-byte key encrypting stored platform tokens.

The long pole is platform review lead time (weeks), not the code.
