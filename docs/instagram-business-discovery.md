# Instagram Business Discovery instead of Apify

Checked 2026-10-12 against Meta's developer docs. Question: can Meta's Business Discovery endpoint replace the paid Apify scrape for Instagram creator feeds?

Short answer: yes for professional (Business or Creator) target accounts, but only for Yapper users who connect Facebook with two extra Instagram permissions, and only after Meta App Review grants those permissions Advanced Access. The code is in place behind a fallback and does nothing until a connection holds those scopes. TikTok stays on Apify.

## What Meta's docs say

The endpoint is `GET /{ig-user-id}?fields=business_discovery.username(target){...}` on `graph.facebook.com`. The `ig-user-id` is the asking user's own Instagram professional account, not the target. It exists only on the Instagram API with Facebook Login. Yapper's Instagram connection uses Instagram Login (`graph.instagram.com`), so that connection can't call it.

| Topic          | Finding                                                                                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permissions    | A Facebook user token with `instagram_basic`, `instagram_manage_insights` and `pages_read_engagement`. If the user's Page role came through Business Manager, also `ads_management` or `ads_read`.                                                        |
| App Review     | Serving users who have no role on the Meta app needs Advanced Access, which needs App Review and Business Verification. Standard Access only works for app admins, developers and testers.                                                                |
| Asking account | The Yapper user must have an Instagram professional account linked to a Facebook Page they manage.                                                                                                                                                        |
| Targets        | Business or Creator accounts only. Personal accounts and age-gated accounts return nothing.                                                                                                                                                               |
| Media fields   | `caption`, `comments_count`, `like_count`, `view_count`, `media_type`, `media_url`, `permalink`, `thumbnail_url`, `timestamp` and more. All are marked Public in the IG Media reference except `like_count`, which Meta omits when the owner hides likes. |
| Views          | `view_count` is documented as Business Discovery only and counts Reels views, paid plus organic.                                                                                                                                                          |
| `media_url`    | Omitted for media with copyrighted or licensed audio and for Reels whose owner turned off downloads. The feed doesn't need it; `thumbnail_url` covers the card. Single-post transcription keeps using Apify.                                              |
| Rate limits    | Business Discovery is under Platform Rate Limits, not the per-account Business Use Case limits. One analysis costs two calls (`me/accounts` and the discovery call).                                                                                      |

Sources: [Business Discovery guide](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery), [IG User business_discovery reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery), [IG Media reference](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media), [Instagram API with Facebook Login overview](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/overview), [Graph API rate limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting).

## Can today's Facebook connection reach it?

Not yet. The Facebook connection requests `pages_show_list`, `pages_read_engagement` and `pages_manage_posts` (`src/lib/publish/platforms.ts`). It has no `instagram_basic` or `instagram_manage_insights`, and the `instagram_business_account` field on a Page needs `instagram_basic` too. The plumbing is there: the row keeps the Facebook user token in `refresh_token_enc` (the Page token sits in `access_token_enc` after a Page is picked) and the granted list in `scope`. Once the login asks for the two Instagram permissions, `me/accounts?fields=instagram_business_account` gives the linked account id.

The Facebook App Review recording (`docs/platform-review-recordings/05-facebook.md`) also says Page review isn't finished, so even the existing scopes are Standard Access today.

## What the prototype does

`fetchCreatorFeed` (`src/lib/inspiration/creator-feed.ts`) now tries Business Discovery first for Instagram, then Apify:

1. `getDiscoveryAccess` reads the Facebook connection and returns null unless `scope` contains all three permissions above. Every current connection returns null here without a network call, so production behavior is unchanged.
2. `linkedInstagramId` finds the Instagram account linked to the selected Page, or any linked Page.
3. `fetchBusinessDiscovery` asks for 24 posts and maps them through `discoveryScrape` into the same `CreatorScrape` shape Apify produces.
4. Any failure logs a warning and falls through to `scrapeCreator`.

Results go into the shared 12 hour scrape cache like Apify's. That is deliberate: every field requested is marked Public in Meta's reference, likes are dropped by Meta when hidden, and age-gated accounts are excluded, so the result contains nothing a signed-out visitor couldn't see. The YouTube exclusion doesn't apply because that token can expose the user's own private uploads; this token only reads other public accounts.

## To turn it on

1. In the Meta app, add `instagram_basic` and `instagram_manage_insights` to the Facebook Login for Business configuration (`FACEBOOK_LOGIN_CONFIG_ID`). Don't add them to `PLATFORMS.facebook.scopes`: the OAuth exchange fails when a listed scope isn't granted, which would break Facebook connect for everyone who has no Instagram account linked.
2. Test with an app-role user who has a Page linked to an Instagram professional account. Reconnect Facebook, then analyze a professional creator.
3. Submit `instagram_basic` and `instagram_manage_insights` for App Review with a recording of the creator analysis screen, and finish Business Verification.
4. Optionally store the linked Instagram id on the connection to save the `me/accounts` call.

The open question is reach. This only saves money for users who have connected Facebook with a linked Instagram professional account, and only for professional targets. The Facebook connection count is worth checking before spending time on App Review.
