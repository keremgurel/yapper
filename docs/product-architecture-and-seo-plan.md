# Yapper product architecture and SEO plan

Updated October 1, 2026. This replaces the version written earlier the same day, which led the homepage with Studio and kept one shared credit subscription. Both of those were reversed.

Evidence is in [the research record](seo/research-2026-10-01/README.md). Per-page targets are in [the page and keyword matrix](seo/page-keyword-matrix-2026-10-01.md). Pricing is in [pricing-2026-10.md](pricing-2026-10.md).

## Decisions

Yapper is one brand with two products that are sold, navigated and billed separately.

|                | Yapper Train                                                                                                                                            | Yapper Studio                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Job            | Speaking practice, training modes, recording, AI feedback, progress                                                                                     | Idea capture, scripts with Chirpy, teleprompter recording, transcript and timeline editing, one-click edits, captions, thumbnails, publishing |
| Availability   | Open, web                                                                                                                                               | Private beta, web and Mac, by invitation                                                                                                      |
| Public pages   | `/products/train`, `/products/train/pricing`, `/products/train/ai-feedback`, `/training` and its exercise pages, `/freestyle-speech`, `/tools`, `/blog` | `/products/studio`, `/products/studio/pricing`, `/features` and its eight feature pages                                                       |
| Primary action | Start practicing                                                                                                                                        | Join the waitlist                                                                                                                             |
| Plan           | Free practice, Train Plus for unlimited AI feedback                                                                                                     | Starter, Creator, Pro with monthly credits                                                                                                    |
| Wallet         | Train sessions                                                                                                                                          | Studio credits                                                                                                                                |

Both stay on ypr.app. No subdomains or separate domains. One account signs in to both. A plan or balance for one product does not work in the other.

The homepage is a brand page with two entrances. It does not carry either product's full pitch.

After a visitor enters a product, the header shows only that product's menu and call to action, with one quiet link to the other product. Which product a page belongs to is decided by its path (`src/data/site-navigation.ts`).

These decisions supersede the documents listed under "Older documents" below.

## Route map

Production state was crawled on October 1 before any of this work. "Now" is what production serves. "After" is what the local branch serves.

| URL                                                       | Now (production)                          | After                                            | Owner      | Disposition and reason                                                                                    |
| --------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------- |
| `/`                                                       | 200, Studio-led landing page              | 200, brand page                                  | Brand      | Improve. Becomes the two-product entrance. See the risk note below                                        |
| `/products`                                               | 200                                       | 308 to `/`                                       | Brand      | Consolidate. Its job (compare the two products) moved into the homepage. It had no Search Console rows    |
| `/products/studio`                                        | 200                                       | 200                                              | Studio     | Keep                                                                                                      |
| `/products/studio/pricing`                                | 404                                       | 200                                              | Studio     | New                                                                                                       |
| `/products/train`                                         | 200                                       | 200                                              | Train      | Keep                                                                                                      |
| `/products/train/pricing`                                 | 404                                       | 200                                              | Train      | New                                                                                                       |
| `/products/train/ai-feedback`                             | 404                                       | 200                                              | Train      | New home of the feedback feature                                                                          |
| `/products/yapper`                                        | 308 to `/products/train`                  | same                                             | Train      | Keep the redirect, now in `next.config.ts`                                                                |
| `/pricing`                                                | 200, one shared plan                      | 200, chooser                                     | Brand      | Improve. Links to each product's pricing. Kept because it is the URL people guess                         |
| `/features`                                               | 200, both products                        | 200, Studio only                                 | Studio     | Improve                                                                                                   |
| `/features/<slug>` (8)                                    | 200                                       | 200                                              | Studio     | Keep. Moving them under `/products/studio/` would cost a redirect each for no gain                        |
| `/features/creator-feedback`                              | 200                                       | 308 to `/products/train/ai-feedback`             | Train      | Move. A Train feature was filed under Studio's features. 5 impressions in 90 days, so nothing is at stake |
| `/studio`                                                 | 308 to `/products/studio`                 | same                                             | Studio     | Keep the redirect. 62 impressions and 0 clicks in 90 days                                                 |
| `/studio?tab=...`                                         | 308 to `/products/studio?tab=...`         | 307 to `/studio/editor`                          | Studio app | Fix. The legacy deep-link rule sat after the plain `/studio` rule and never matched                       |
| `/studio/*`                                               | Protected                                 | Protected                                        | Studio app | Unchanged. Disallowed in robots, gated in `src/proxy.ts`                                                  |
| `/training`                                               | 200                                       | 200                                              | Train      | Keep. The practice hub                                                                                    |
| `/training?mode=<slug>`                                   | 200, canonical `/training`                | 200, canonical to the exercise page              | Train      | Decided below                                                                                             |
| `/training/<exercise>` (8)                                | 200                                       | 200                                              | Train      | Keep                                                                                                      |
| `/training/freestyle-speech`                              | 308 to `/freestyle-speech`                | same                                             | Train      | Keep                                                                                                      |
| `/freestyle-speech`                                       | 200                                       | 200                                              | Train      | Keep. Established URL                                                                                     |
| `/freestyle`                                              | 308 to `/freestyle-speech`                | 301, and `/freestyle/` now goes there in one hop | Train      | Fix. `/freestyle/` used to take two hops                                                                  |
| `/random-topic-generator`                                 | 301 to `/training/random-topic-generator` | same                                             | Train      | Keep. Old links and blog posts point here                                                                 |
| `/tools`, `/tools/words-per-minute`                       | 200                                       | 200                                              | Train      | Keep                                                                                                      |
| `/blog`, `/blog/<post>` (23)                              | 200                                       | 200                                              | Train      | Keep every URL. All posts are about speaking                                                              |
| `/privacy`, `/terms`                                      | 200                                       | 200                                              | Brand      | Keep                                                                                                      |
| `/progress`, `/history`, `/studio-access`, `/style-guide` | 200, noindex, canonical `/`               | 200, noindex, no canonical                       | App        | Fix. A noindex page should not also claim to be the homepage                                              |

Every redirect is a single permanent hop to an equivalent page. Nothing redirects to the homepage except `/products`, whose content moved there. The `www` host rule still adds a hop for `www.ypr.app/studio` and similar. That predates this work and is left alone.

### Practice mode URLs

`/training?mode=interview-prep` opens an exercise inside the hub. It is a UI state that duplicates the exercise's own page. Each mode now declares the exercise page as its canonical (`/training/interview-prep`, or `/freestyle-speech` for freestyle). A mode with no page of its own (`research-and-explain`) and any unknown value are `noindex, follow` with no canonical. Mode URLs are not in the sitemap. The links themselves still work exactly as before.

### The homepage risk

Google ranks `/` for topic generator searches because the homepage used to be the generator. Those searches produced 210 of the site's 731 clicks in the last 90 days. The generator page at `/training/random-topic-generator` has no impressions yet.

The brand homepage no longer has a generator on it. To give Google a clear new owner: the homepage's Train section has the practice timer demo and its main button reads "Try the random topic generator" and goes straight to that page; the generator page's H1 now says "Random topic generator for speaking practice"; the old top-level URL already redirects to it; and every page's footer links to it by name.

This may still cost clicks for a while. It is the first thing to check after release.

## Navigation

| Context | Paths                                                                                                   | Header                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Brand   | `/`, `/pricing`, `/privacy`, `/terms`                                                                   | Studio, Train, Pricing                                                                                                        |
| Studio  | `/products/studio/*`, `/features/*`, `/studio/*`                                                        | "Studio" beside the wordmark. Features menu, Pricing. Button: Join the waitlist. Quiet link: Yapper Train                     |
| Train   | `/products/train/*`, `/training/*`, `/freestyle-speech`, `/tools/*`, `/blog/*`, `/progress`, `/history` | "Train" beside the wordmark. Practice menu, AI feedback, Guides, Pricing. Button: Start practicing. Quiet link: Yapper Studio |

A test asserts that neither product's menu contains a link into the other product. The footer has one column per product.

## Structured data

The homepage carries `WebSite` and `Organization`. Each product overview carries one `SoftwareApplication`. Feature pages and the feedback page are `WebPage` with `about` pointing at their product. Breadcrumbs emit `BreadcrumbList`. Blog posts keep their existing markup. There are no ratings, review counts, offers or platform claims that the product cannot back up.

## Sitemap and lastmod

The sitemap is built from one registry, `src/lib/seo/public-routes.json`, plus blog posts. It contains canonical 200 pages only. `lastmod` is the date of the last git commit that touched the files that render each page, written by `npm run seo:lastmod` into a committed file, the same method speaking-coach uses. Blog posts use their published date. `priority` and `changefreq` were removed because Google ignores them.

The generated dates currently read October 1 for every page because the changes are uncommitted and the generator was run with `--allow-dirty`. Run it again after committing.

## Status

| Item                              | Researched       | Implemented locally      | Tested                                                                                | Deployed | Indexed | Measured      |
| --------------------------------- | ---------------- | ------------------------ | ------------------------------------------------------------------------------------- | -------- | ------- | ------------- |
| Search Console baseline           | Yes              | n/a                      | n/a                                                                                   | n/a      | n/a     | Baseline only |
| Keyword volumes and SERPs         | Yes (DataForSEO) | n/a                      | n/a                                                                                   | n/a      | n/a     | n/a           |
| Semrush and Content Optimizer     | Blocked          | n/a                      | n/a                                                                                   | n/a      | n/a     | n/a           |
| Conversion data by product        | Blocked          | n/a                      | n/a                                                                                   | n/a      | n/a     | n/a           |
| Brand homepage                    | Yes              | Yes                      | Rendered audit, desktop and phone, both themes                                        | No       | No      | No            |
| Product navigation                | Yes              | Yes                      | Unit tests, keyboard open and Escape, phone menu                                      | No       | n/a     | No            |
| Separate pricing pages            | Yes              | Yes                      | Rendered audit, visual                                                                | No       | No      | No            |
| Separate wallets and entitlements | Yes              | Yes, with migration 0034 | Unit tests with mocked database and Stripe. No test against a real database or Stripe | No       | n/a     | No            |
| Redirects                         | Yes              | Yes                      | Rendered audit, 7 of 7                                                                | No       | No      | No            |
| Practice mode canonicals          | Yes              | Yes                      | Unit test and rendered audit                                                          | No       | No      | No            |
| Sitemap lastmod                   | Yes              | Yes                      | Rendered audit                                                                        | No       | No      | No            |
| Train AI feedback page            | Yes              | Yes                      | Rendered audit, visual                                                                | No       | No      | No            |

"Tested" means what the row says and no more. No Lighthouse run, no field Core Web Vitals, no signed-in checkout, no real feedback request and no Mac app check were done.

## Validation results

`python3 scripts/audit-marketing-seo.py http://localhost:3111` against the local dev server: pass for 31 pages, 23 posts, 7 redirects and 54 sitemap URLs. Full output is in `seo/research-2026-10-01/local-audit.txt`. It checks status, one self-referencing canonical, one H1, unique titles and descriptions, no accidental noindex, parseable JSON-LD, sitemap equal to the registry with a lastmod on every URL, no orphan pages, no internal links to redirecting URLs, each redirect landing in one hop on a 200, the mode canonicals, noindex on signed-in pages, the workspace refusing signed-out requests, and robots.txt.

Twelve blog titles are longer than 65 characters with the site suffix. They are reported as warnings and left alone, because the longest-standing one is the site's top page.

Reading the rendered heading outlines also turned up three things the audit did not check, all fixed: Train exercise pages ended with a Studio waitlist form, practice prompts and demo labels were marked up as `h2`, and footer column titles were headings on every page.

The first run found four exercise pages with no crawlable link from any other page (they were reachable only through a JavaScript menu and `?mode=` links). The hub now lists each exercise page in plain links.

Unit tests: the whole suite passes, 1,944 tests in 265 files, including new tests for the catalog split, checkout per product, the webhook per product, the shared-wallet rule, navigation and mode canonicals. TypeScript and ESLint are clean on the changed files.

Seen in a browser: homepage, Train pricing, Studio pricing, pricing chooser and the feedback page at desktop width; homepage and Train pricing at 375px with no horizontal overflow; Train pricing in dark mode (page `#000`, cards `#171719`); header menu opens from the keyboard and Escape returns focus to its trigger.

## Remaining work, in order

1. Decide whether to release the wallet split. It adds columns and changes where new welcome credits land. Read `docs/pricing-2026-10.md` first.
2. Connect Yapper's PostHog project and record the conversion baseline before release.
3. Commit, run `npm run seo:lastmod`, commit the generated dates.
4. Replace the sample content in Studio demos with real product captures.
5. Rewrite the eight Studio feature pages' body copy. Their titles and H1s were set earlier today from intent, without volumes. The matrix marks which ones should change.
6. Give `/training/interview-prep` and `/tools/words-per-minute` the content the matrix describes. Those two have the clearest demand after the generator.
7. Run Content Optimizer on the pages marked pending once Semrush access is back.
8. Remove dead components left from the old header (`src/components/training/mobile-nav.tsx`, `training-nav-dropdown.tsx`).

## Release checklist

None of this has been done. Deploying, DNS, indexing requests and Stripe changes all need explicit approval.

1. Review migration `drizzle/0034_product_wallets.sql`. The production build runs migrations automatically, so merging to the production branch applies it.
2. Create the Stripe prices listed in the pricing doc and set their environment variables. Until then the new plans answer "not available for checkout yet".
3. Ship an updated Mac app before or with the release if it reads the credit balance for Train feedback. The status API keeps its old fields and adds a `train` object.
4. Deploy. Confirm each row of the route map against production with the audit script pointed at `https://ypr.app`.
5. In Search Console, submit the sitemap and inspect `/`, `/training/random-topic-generator`, `/products/train` and `/products/studio`. Do not request indexing in bulk.
6. Record the release date. It starts the measurement windows below.

## Measurement plan

Compare finalized windows of equal length only. Search Console data settles after about two days, so a window is read once its last day is final. Use its dates as reported (Pacific) and do not mix them with UTC analytics days.

| Window                     | Compared with                             |
| -------------------------- | ----------------------------------------- |
| Days 1 to 14 after release | The 14 days ending the day before release |
| Days 1 to 28 after release | The 28 days ending the day before release |

The pre-release baseline on record is Aug 31 to Sep 27: 110 clicks, 5,236 impressions.

Search, by product, from Search Console page and query rows:

| Product | Watch                                                                                                                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Train   | Clicks and impressions for `/training/random-topic-generator` and for `/` on topic generator queries. The goal is for the generator page to take over those queries. Clicks to `/blog/1-minute-speech-topics`. Position of "random topic generator" |
| Studio  | Impressions and position for each `/features/*` page and `/products/studio`. Expect small numbers while Studio is gated                                                                                                                             |
| Brand   | Which URL Google shows for "yapper" and "yapper pricing"                                                                                                                                                                                            |

Activation and conversion, from Yapper's PostHog project once connected. Events already exist in code.

| Product | Activation                                                                             | Conversion                                                                                          |
| ------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Train   | `session_started` and `session_completed` per organic landing session, by landing page | First feedback request, Train Plus checkout started, Train Plus paid (from Stripe, not the browser) |
| Studio  | Visit to `/products/studio` or a feature page that reaches the waitlist section        | `waitlist_submitted` with success, by landing page                                                  |

Keep paid and organic apart, renewals apart from first purchases, and test accounts out. A waitlist signup is not an activated Studio user.

At 14 days, look at direction and indexing: is the generator page indexed, did the redirects get picked up, did anything 404. At 28 days, judge traffic and activation against the baseline. Revert quickly for broken access or an indexing regression. Do not rewrite titles because positions moved for a few days.

## Older documents

| Document                                         | Status                                                                                                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/product-vision.md` (July)                  | Superseded where it folds training into the creator funnel and where it describes one paywall and credit pool. Its feature inventory is still useful           |
| `docs/keyword_research.md` (April)               | Historical. Volumes have no provider export. Do not use for prioritization                                                                                     |
| `docs/seo-research-2026-08.md`                   | Historical. Volumes superseded by the October 1 pull                                                                                                           |
| `docs/unit-economics-and-pricing.md` (September) | Provider cost tables in sections 2 and 3 remain the cost basis. Its plan and credit recommendations in sections 7 and 8 are superseded by `pricing-2026-10.md` |
| `docs/public-billing-design.md`                  | Superseded where it describes a single membership                                                                                                              |
| `docs/design-system.md`                          | Updated in place for the navigation and pricing changes                                                                                                        |
