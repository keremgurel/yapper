# What to take from Postiz

[Postiz](https://github.com/gitroomhq/postiz-app) is an open-source social
scheduler (NestJS API, Temporal workers, Next.js frontend). This note records
what we read in its source on October 27, 2026 (commit `a5affe6`, v1.47.0) and
which ideas are worth bringing into Yapper.

## License

Postiz is AGPL-3.0-or-later. Copying its code, or closely translating it, would
make Yapper a derivative work, and because Yapper runs as a network service we
would then owe every user the full source of the combined app. Ideas,
architecture and platform protocol facts are free to use. We take ideas only
and implement from the platform docs; no Postiz code is in this repository.

## How Postiz schedules

Every post gets one Temporal workflow that sleeps on a durable timer until the
publish time, then posts, polls the platform until processing finishes, and
runs follow-ups such as comments. Editing or dragging a post kills that
workflow and starts a new one. An hourly sweep pokes any post from the last two
days that is still queued, so a lost workflow is restarted rather than
forgotten. Irreversible calls are never retried automatically: when the
outcome is unknown, the post is marked as an error with "check your account
before posting again".

Yapper's scheduler now follows the same shape without Temporal. The publish
clock (a Cloudflare Durable Object alarm) wakes at the next due time, an hourly
cron sweeps as a safety net, and unknown outcomes already show "Check the
platform". See [scheduled-publishing.md](scheduled-publishing.md).

## Taken in the scheduling change

| Idea from Postiz                                                          | In Yapper                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Durable timer per due time plus an hourly missed-post sweep               | Publish clock alarm set from each sweep's `nextDueAt`, hourly cron |
| Sweep only looks back two days, so a revived queue doesn't fire old posts | Posts more than a day late fail with "Choose a new time"           |
| Poll a processing post every 20 s for up to 30 min                        | Recheck every 45 s for up to an hour, same publish key             |
| Click a calendar cell to start a post at that time                        | "+" on a day opens Poster set to Schedule at that time             |
| Past slots can't take a drop                                              | Dropping a scheduled post on a past day is refused                 |

## Worth doing next

Ranked by value to a solo creator against effort.

| Idea                                               | What it would be in Yapper                                                                                                                                                                                           | Effort         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Agent scheduling (their MCP server and public API) | Chirpy actions to list channels, schedule, move and cancel posts, validated by the same server checks as Poster. Postiz generates each platform's settings schema from its validators so the agent knows the fields. | Medium         |
| Posting times and "next free slot"                 | Per-channel preferred times; a quick pick in the Schedule switch that takes the next open one                                                                                                                        | Low            |
| Resumable YouTube upload across invocations        | Postiz uploads in 8 MB chunks with a four-minute budget per call and resumes from the session offset. Our upload runs in one function call, so very large files can hit the five-minute limit.                       | Medium to high |
| Late TikTok post ids                               | When Direct Post finishes before moderation, Postiz stores the profile URL and looks up the public id later. We store no link in that case.                                                                          | Medium         |
| Per-platform preview                               | How the caption, cover and title will look on each platform before scheduling                                                                                                                                        | Low to medium  |
| Repeat posts                                       | Re-post an evergreen video every N days. Postiz needed extra logic so a restart doesn't fire a burst of repeats.                                                                                                     | Medium         |
| Signatures                                         | Saved closing text (CTA, hashtags) added to captions per platform                                                                                                                                                    | Low            |
| First comment                                      | Post a comment with links or hashtags a few minutes after publishing, where the platform allows it                                                                                                                   | Medium         |
| Week view with hour rows                           | Postiz's week view is 7 columns by 24 hours with a "now" line; ours stacks a day's posts                                                                                                                             | Low to medium  |

Postiz features we don't need: agency customer groups, public preview links
with review comments, short-link tracking, webhooks, RSS auto-posting, and
X-specific auto-plugs.

## Bugs it pointed at in our code

TikTok returns `publicaly_available_post_id` as a 64-bit integer. `JSON.parse`
loses precision past 2^53, so `src/lib/publish/server/tiktok-direct.ts` gets an
unsafe number, drops it, and saves the post without a link. Postiz reads the id
from the raw response text instead. The same fix applies here.

Postiz never fetches TikTok's `creator_info` and hardcodes the privacy options.
Yapper already queries it, and checks it again at send time for scheduled posts.
