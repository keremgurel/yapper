# Yapper product architecture and SEO plan

Agreed direction, October 1, 2026. The first public-site implementation is in local review; it has not been deployed. Research below records the pre-change state.

Organize ypr.app around two products: **Yapper helps people become better speakers. Yapper Studio helps creators turn ideas into published content.** Studio contains the capture, writing, recording, editing, and publishing workflow. Training has its own promise, product page, and conversion path.

The recommended first release is a coherent public website with complete coverage of real capabilities. Native mobile app design and external agent integrations follow separately. A two-product brand does not require two domains, codebases, accounts, or new subscription plans now.

## Proposed decisions

- Keep both products on ypr.app. This keeps discovery, maintenance, and cross-product journeys together; it is not a claim that a particular URL folder automatically improves rankings.
- Add a products directory and dedicated product overviews. Keep feature URLs where practical, with explicit product ownership in navigation, breadcrumbs, copy, and structured data.
- Lead the homepage with Studio while making speaking training visible immediately. Approved as the initial direction for the public-site implementation.
- Keep the metallic orange primary button, existing brand colors, and Chirpy. Establish more restrained typography, aligned containers, compact navigation, and real product demonstrations.
- Separate public product discovery from authenticated workspaces. A marketing feature link should not unexpectedly open a password gate.
- Make every capability discoverable. Give a capability its own indexable page only when it has a distinct user/search intent and enough useful evidence. Smaller controls belong in relevant feature sections and documentation.

## What the current site tells us

Read-only research covered repository routes, marketing data, design tokens, product and release documents, live homepage and training content, desktop screenshots at 1280 × 720, and a homepage screenshot at 390 × 844. This is a planning review, not a completed accessibility or responsive audit. Keyboard states, dark mode, 320px, tablet, and performance remain implementation acceptance checks.

| Finding | Evidence | Implication |
| --- | --- | --- |
| Conflicting product definitions | Homepage sells content creation, its first major section teaches speaking, and the footer still describes a free random-topic generator | Rewrite the shared story across the entire public shell |
| Feature coverage already exists | `src/data/marketing-features.ts` defines nine feature pages | Improve and connect these pages rather than start from an empty inventory |
| Navigation hides the product breadth | Desktop navigation exposes Studio, Training, Pricing, Blog; no products or features directory | Add a compact product menu with meaningful descriptions |
| Training mixes discovery and practice selection | `/training` opens with a drill selector, alongside broad “training programs” metadata | Give the training product a proper overview; keep the practice hub task-focused |
| Studio has an SEO defect | Live `/studio` returns 200 and `index, follow`, but its canonical is `https://ypr.app` | Give its eventual canonical product destination a self-referencing canonical |
| Sitemap omits Studio | Live sitemap contains 48 URLs: 24 blog, 10 feature, 9 training, 2 tool, home, pricing, freestyle | Add the canonical product pages; sitemap presence does not establish indexation |
| Public and private routes share a namespace | `/studio` is public; `/studio/*` is protected and disallowed in robots | Keep new public feature/product pages outside the protected subtree |
| Design documentation has drifted | `docs/design-system.md` specifies Hanken Grotesk; `globals.css` uses system fonts | Reconcile the source of truth before changing page typography |
| Outer widths differ | Shared marketing container is 1200px, Studio sections use `max-w-5xl`, header uses viewport padding | Apply one shared outer container to header, pages, dropdown, and footer |
| Availability copy needs verification | Feature schema says macOS and Windows; current Studio navigation describes a native Mac editor | Use a capability/platform matrix; distinguish working code, beta access, and released availability |

The July product vision explicitly subsumed training into the creator funnel. The new two-product direction should replace that positioning after agreement. April keyword research and August research also describe different product stages. Preserve useful research, date it, and update strategy rather than silently treating all three as current.

## Postiz business and acquisition research

Postiz is a relevant benchmark, but public pages cannot establish its complete economics or acquisition attribution. As observed October 1, TrustMRR displays **$226,030 MRR, 6,629 active subscriptions**, with a September 30 update and Stripe verification. Its separate last-30-days revenue figure should not be called MRR. This supports the scale benchmark, not a claim that SEO caused it. [Revenue source](https://trustmrr.com/startup/postiz)

| Mechanism observed | What Yapper should adopt |
| --- | --- |
| A specific agent-driven publishing outcome, supported by a visual calendar and a broad channel network | Lead Studio with a complete creator outcome and show the workflow in the actual product, rather than give equal weight to every internal screen |
| Four cloud tiers at $29, $39, $49, and $99 monthly, with channel allowances and a seven-day trial; agent/API access is included | Make product access and limits easy to understand. Price Yapper from its own costs and customer value; do not copy prices or promise a new bundle yet |
| Open-source distribution and a hosted service | Learn from its developer reach and low-friction evaluation. Open-sourcing Yapper is a separate business decision |
| Dedicated platform landing pages | Publish pages for verified Yapper destinations, with supported formats, account requirements, actual workflow, and limitations |
| Dedicated ChatGPT, MCP, and other agent entry pages | When integrations work, pair each with setup instructions, example actions, and a direct connection path |
| Alternatives and pairwise comparison directories | Start with a few researched comparisons relevant to talking-head creators; avoid a large generic competitor matrix |
| A large free-tool directory plus educational blog content | Connect useful creator/speaking tools to their nearest product feature and next action |
| Founder-led social demonstrations and public growth stories | Use Yapper to demonstrate the creator workflow and publish the resulting examples; measure downstream activation |

Sources: [homepage](https://postiz.com/), [pricing](https://postiz.com/pricing), [repository](https://github.com/gitroomhq/postiz-app), [TikTok page](https://postiz.com/channels/tiktok), [ChatGPT page](https://postiz.com/chatgpt), [MCP page](https://postiz.com/mcp), [alternatives](https://postiz.com/alternatives), [comparison example](https://postiz.com/compare/sprinklr), [free tools](https://postiz.com/tools), [founder marketing account](https://postiz.com/blog/saas-marketing-strategy-chatgpt-astra-2-2m-arr).

The transferable strategy is multiple useful discovery paths into one product. Page volume alone is not evidence of rankings, quality, or conversion. Postiz's comparison coverage extends beyond comparisons involving Postiz; Yapper should first explain its own strongest use cases. Its affiliate, documentation, community, and roadmap links are additional distribution/support surfaces visible in the footer, not evidence of revenue attributable to those channels.

Not established in this pass: organic traffic, top ranking pages, referring domains, keyword overlap, paid acquisition share, churn, margins, or cohort retention. Postiz's robots and sitemap requests returned 403 in the direct fetch, so no exhaustive crawl count is claimed. Before setting traffic goals, obtain Yapper Search Console/analytics baselines and a dated competitor keyword report through an authorized connection. Do not purchase API access or units. Browser-based Semrush research must use the Can profile specified in AGENTS.md.

Yapper's proposed differentiation is the continuity from a creator's own idea and voice through recording, editing, and publication. Broader network count is not the initial competitive claim.

## Public page architecture

| Destination | Purpose and treatment |
| --- | --- |
| `/` | Brand overview, immediate explanation of both products, Studio-led showcase |
| `/products` | Compare the two products by purpose, audience, availability, and next action |
| `/products/yapper` | Speaking-training product overview; lead to a first practice session |
| `/products/studio` | Full creation workflow overview; beta/waitlist CTA until public access is verified |
| `/features` | Studio capability directory, grouped by capture/write, record, edit, publish |
| `/features/*` | Preserve nine existing URLs and improve their unique content |
| `/training` | Practice hub with a recommended first session and clearly grouped drills |
| Existing training drill URLs | Preserve their exact practice intent and working tools |
| `/tools` and existing tool URLs | Useful standalone utilities, clearly distinguished from gated app features |
| `/integrations` and `/integrations/[platform]` | Add when platform support and release status are verified |
| `/blog` | Retain current URLs; curate by speaking and creating; add editorially useful internal links |
| `/pricing` | Make access to each product explicit; preserve existing entitlements until a pricing decision |
| `/compare/[competitor]` | Later, a small number of maintained, evidence-based comparisons |
| `/developers` and integration setup pages | Later, only after usable public integration contracts exist |

Proposed consolidation: permanently redirect the exact public `/studio` URL to `/products/studio`, retaining `/studio/*` workspace routes and existing auth/handoff behavior. First inspect Search Console and incoming links, then update all owned links, sitemap, metadata, and canonicals together. Do not use a wildcard that redirects the workspace. If migration evidence favors keeping `/studio`, it can remain the one canonical Studio product page instead; do not publish duplicate overviews.

Keep `/training` as a practice destination, not a duplicate of `/products/yapper`. Keep `/freestyle-speech` and existing working redirects until traffic evidence supports another move. No cosmetic mass migration of feature or blog slugs is required. [Google migration guidance](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)

## Capability coverage and search intent

The phrases below are proposed intent owners, not freshly measured keyword volumes. August's saved DataForSEO estimates can inform prioritization but need a current check before numerical forecasts.

| Capability | Page or location | Proposed intent and proof |
| --- | --- | --- |
| Idea capture | Existing `/features/idea-capture` | Capture and organize content ideas; show voice, text, and link inputs |
| Script writing | Existing `/features/ai-script-writer` | Video script generator; demonstrate rough idea, hook options, editable script |
| Teleprompter and recording | Existing `/features/teleprompter-recorder` | Teleprompter recorder; demonstrate script, pace controls, and resulting take |
| Transcript editing | Existing `/features/transcript-video-editor` | Transcript video editor; show a text deletion and the resulting cut |
| Captions and dictionary | Existing `/features/automatic-captions` | Automatic video captions; show timed output, styles, vocabulary corrections |
| Creator feedback | Existing `/features/creator-feedback` | Feedback on recorded delivery; explain its relationship to both products without duplicating pages |
| Social publishing and scheduling | Existing `/features/social-publishing` | Social media scheduling; show destination selection, review, schedule, and actual delivery states |
| Content planning | Existing `/features/content-calendar` | Content calendar; distinguish planning dates from armed publishing schedules |
| Project organization | Existing `/features/content-library` | Video/content library; verify current Ideas vs Library experience before describing it |
| Brand voice and knowledge | Candidate `/features/brand-voice` | Reusable creator context; show the same idea with and without real saved context |
| AI overlays and visual editing | Candidate `/features/ai-video-overlays` | Video overlays; show actual before/after output and supported editing controls |
| Automations | Candidate `/features/social-media-automation` | Repeated cross-posting workflow; publish operational claims only after worker/provider checks |
| Chirpy assistance | Candidate `/features/ai-content-assistant` | In-app assistant acting on content; distinguish from unshipped external MCP support |
| Brand kit, framing, retouch, audio, exports | Sections of editing/overlays pages, with supporting help content | Cover every verified capability without giving each setting a thin landing page |
| Connections, storage, account controls | Integration/access documentation and pricing limits | Clear utility coverage, not decorative feature-page expansion |
| Speaking practice and coaching | `/products/yapper`, `/training`, existing drill pages | Speaking practice, feedback, fluency, interviews, camera delivery; distinguish live activities from guides |

A free tool must actually be usable as described. The tools registry includes gated teleprompter and editor entries, but `publicTools` filters those out of the public directory. Preserve that distinction; do not advertise gated Studio features as public free tools.

Every substantial feature page needs: a specific outcome, real demonstration, useful workflow explanation, availability and limits, a relevant next step, contextual links to adjacent features, and a small set of genuine questions. Its demonstration should be distinctive: script examples for writing, video before/after for editing, destination previews for publishing. Shared layout primitives are useful; identical filler sections are not.

## Navigation and page composition

Desktop global navigation proposal: **Products · Features · Resources · Pricing**, followed by **Sign in** and a clearly named primary action. Products opens a compact two-product menu. Features is grouped around the four Studio jobs. Resources holds free tools, speaking practice, and guides. Add Integrations or Developers to the top level only when there is enough released content to justify it.

The Products menu gives each product its name, one-sentence purpose, overview link, and two or three useful entry points. Include “All products” at the bottom. Use normal text hierarchy and quiet separators. Do not reproduce Stripe's five-column density with only two products. Mobile uses visible product labels and one level of disclosure, with an overview link always reachable. Hover, click, keyboard, focus return, Escape, and tap must all work.

Global CTA proposal while Studio remains gated: “Explore Studio”; Studio pages use “Join the Studio waitlist”; Yapper pages use “Start practicing.” Keep returning-user access separate and avoid a global “Start free” that obscures which product starts.

Homepage order:

1. A short creator outcome, immediately naming Yapper Studio and linking the speaking-training alternative.
2. A real Studio preview with a concise idea → script → record → edit → publish sequence.
3. Two clearly named product summaries with availability and distinct actions.
4. Four Studio workflow sections, each linking its detailed feature pages.
5. One focused Yapper training section with a real practice/feedback preview.
6. Verified evidence, supported integrations, and clear availability.
7. A brief product-choice FAQ and consistent footer.

Move the extended training walkthrough and topic-generator FAQs to the relevant training destinations. Keep the homepage useful even when visitors do not scroll through a long demonstration. `/products` is a short choice/comparison page, not another copy of the homepage. Training's hub should lead with one useful first session, then group options by skill or situation instead of presenting every program as equally urgent.

## Design direction

Borrow Stripe's hierarchy: compact navigation, product names with explanatory sublines, measured heading sizes, aligned columns, and deliberate spacing. The observed desktop Stripe navigation uses a `sohne-var` font stack at 14px/400. That is reference evidence, not permission or a requirement to copy its font files. [Stripe reference](https://stripe.com/)

Reconcile the existing Yapper documentation with the actual system font first. Recommended initial proof uses the current system sans with adjusted weight and sizing. Evaluate a properly licensed alternative only if that proof fails to achieve the desired character. Do not change fonts and brand identity merely to imitate another company.

| Token or component | Proposed standard |
| --- | --- |
| Outer container | Existing 1200px maximum shared by navbar, dropdown, page content, footer |
| Gutters | 20px mobile, 24px tablet, 32px desktop; narrow reading columns nested inside |
| Desktop hero | 56–64px, weight 500–600, line-height about 1.08; short headline |
| Mobile hero | 36–40px, line-height about 1.12; verify at 320px |
| Section heading | 32–40px desktop, 28–32px mobile |
| Body and introductions | 16–18px body; 18–20px introductions; 1.5–1.65 line-height; 60–70ch measure |
| Navigation | 14–15px, weight 400–500; descriptions use quiet readable text |
| Sections | Existing 4px scale; generally 64–96px desktop and 40–56px mobile |
| Palette | Retain page #FBFAF8, ink #201D1D, secondary #5B5656, border #E2E0E0, orange #F97316 through existing semantic roles; validate actual contrast pairs |
| Primary button | Retain the shared metallic treatment and press states; no page-specific recreations |
| Surfaces | Mostly open layouts and neutral separators; product media carries visual interest |
| Motion | Functional, generally 150–250ms for menus; reduced-motion support; no repeated scroll entrances |

Keep Chirpy as a recognizable supporting brand element; use actual content and product output as the dominant hero media. No decorative accent rails, background glows, arbitrary per-feature palettes, all-caps labels, or card grids used as a substitute for structure. Light and dark themes must both be reviewed. Native mobile may share brand tokens while using platform-appropriate controls later.

## SEO foundation and content sequence

First establish one page owner per search intent. Product pages explain the whole product, feature pages solve a specific job, tool pages let people do something, and guides teach a task. Cross-link these with descriptive text and relevant next steps. Avoid separate synonym pages such as “AI script writer” and “video script generator” unless search/user needs demonstrably differ. [Google SEO guidance](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)

Technical acceptance: explicit self-canonicals, unique titles/descriptions, coherent headings, crawlable links, actual update dates in sitemaps, indexable public pages, private workspace protection, and no broken or chained redirects. Correct the existing Studio canonical and macOS/Windows schema claims. Represent the two actual applications consistently in structured data; feature pages should describe their parent product rather than invent separate apps. Only include offers, ratings, or platform availability supported by reality. FAQ copy can help users without promising rich results.

Initial editorial sequence after core pages:

| Batch | Content | Product connection |
| --- | --- | --- |
| 1 | Rework nine existing feature pages and the two product overviews | Complete the conversion destinations first |
| 2 | “Turn a voice note into a video script”; “Read a teleprompter naturally”; “Edit a video by editing its transcript” | Ideas, script, recorder, editor |
| 3 | “Caption names correctly”; “Prepare one video for multiple platforms” | Captions/dictionary and publishing, with verified limitations |
| 4 | Improve existing speaking guides and add a simple daily practice routine where coverage is missing | Yapper practice and feedback |
| 5 | A small supported-platform set, then useful tools and selective comparisons | Released integrations and specific conversion paths |

Review existing blog coverage before creating each article. A sustainable initial cadence is one or two substantial pieces per week, contingent on real examples and working destination pages. Prioritize qualified visits and product activation, not an arbitrary page count.

Measurement: capture a 28-day pre-change baseline by page and product. Track non-brand search clicks/impressions, feature-to-product CTR, Studio waitlist conversions, first saved idea, first export, first successful post, training session completion, and repeat practice. Distinguish waitlist signup from activated product use. Observe indexing/redirects after release, review discovery at 30 days, and evaluate qualified conversion trends at 60–90 days. Set numerical growth targets only after the baseline and release availability are known.

## External agents and future mobile apps

The existing shared action contract in `docs/chirpy-shared-actions.md` is a useful foundation. It documents feature-owned operations and runtime capability checks, but also says web migration is incomplete. A search of the inspected docs/source did not locate a shipped public MCP service or ChatGPT/Claude integration plan. This does not establish that no plan exists elsewhere.

Proposed later sequence: stable application actions → authenticated external API → hosted MCP adapter → tested client integrations and setup pages. Reuse the same validation and results used by the UI. Separate draft creation from external publication, preserve review requirements, and make scheduling/retries reliable. A native editing action may require the desktop runtime; do not promise that every local action can run in a cloud agent. Reserve integration page concepts now; publish them as functional offerings only when tested.

Future Yapper mobile loop: practice → feedback → repeat → progress. Future Studio mobile loop: capture → script → record → review/edit → publish, refined around actual mobile capabilities. Establish shared brand components and product-specific navigation after the public site architecture is settled. No native mobile screen build is part of this release.

## Implementation sequence and definition of done

| Phase | Concrete work | Completion gate |
| --- | --- | --- |
| 1. Product and page inventory | Resolve product names/ownership, release matrix, existing route and query baseline, CTA rules, redirect map | Every existing feature and training route has an owner and disposition; claims verified |
| 2. Shared design proof | Update design docs/style guide; build public header/footer, product menu, homepage, both product overviews, one representative feature page | Review desktop/mobile, light/dark, alignment, typography, menus, focus, reduced motion |
| 3. Complete offering coverage | Upgrade all nine feature pages; add justified missing pages; simplify training hub; align products/pricing/resources | Every core job reachable in at most two navigation choices; no false availability claims or gated marketing links |
| 4. SEO release | Apply metadata/schema/sitemap/internal-link updates and any approved exact redirects; replace stale footer and FAQ copy | Public crawl passes, canonicals and route status verified, private routes protected, no orphan core pages |
| 5. Measured expansion | Editorial sequence, verified platform pages, selective comparisons, later agent setup pages | Actual usage examples, differentiated content, dated facts, measurable relevant conversions |

Use reviewable implementation slices. Read the installed Next.js guides before implementation, as required by AGENTS.md. Initial files include `globals.css`, `docs/design-system.md`, `/style-guide`, public header/mobile nav/footer, home and product routes, marketing feature registry/template, training hub, metadata helpers, sitemap, robots, and redirect configuration. Preserve unrelated work already present in the working tree.

The first implementation slice should include the shared shell, homepage, products directory, the two product overviews, and one complete feature page. Keep URL/redirect activation coordinated so existing pages do not break between slices. Run appropriate build/type/lint checks and meaningful navigation/route checks. Verify 320px, 390px, tablet, and desktop visually before calling UI work complete, including menu and account states.

## Agreed address strategy and local implementation

Use `ypr.app` for public product overviews, feature pages, guides, pricing, and search acquisition. Proposed future application addresses are `studio.ypr.app` for content creation and `learn.ypr.app` for speaking practice. These describe the authenticated or interactive destinations, not separate marketing sites. App subdomains are not configured in this implementation; DNS, hosting, session sharing, callback URLs, and workspace migrations need a separate coordinated release. Existing application routes remain operational.

The local implementation includes the shared header/footer, homepage, products directory, both product overviews, all nine existing feature pages, simplified training hub, and pricing context. Creator feedback is explicitly owned by Yapper and cross-linked from the Studio features directory. Public pages have unique metadata, product ownership in structured data, breadcrumbs, and sitemap entries. The exact `/studio` landing page redirects to `/products/studio`; authenticated descendants keep their protection.

The visual proof uses system sans, shared 1200px containers, restrained typography, existing orange metallic buttons, and illustrative interactive workflow examples. Those examples are labelled as illustrations; actual product captures and output evidence remain follow-up work before the broader content rollout.

Launch follow-ups: capture Search Console and analytics baselines, review incoming links to `/studio`, replace illustrative examples with verified product media, complete release checks for candidate feature/platform pages, and review waitlist conversion tracking. Quantitative competitor keyword/backlink research, new comparison/editorial pages, external agent integrations, and native mobile apps remain separate work. Existing pricing and entitlements are unchanged.

### Local verification — October 1, 2026

- Production Next build completed (163 pages). Ran `npx next build` directly to avoid the repository build script's production migration step. An existing file-tracing warning involving `bounded-temp-file.ts` and `next.config.ts` remains outside this website change.
- TypeScript, targeted ESLint, formatting checks, and `git diff --check` passed.
- Crawled 16 core/product/feature pages: HTTP success, one H1, one expected self-canonical, and parseable structured data. Sitemap has 51 unique URLs, including all three product destinations.
- Exact `/studio?from=old` returned 308 to `/products/studio?from=old`. `/studio/home` still redirects unauthenticated users to sign-in. Unknown feature returned 404.
- Visually checked representative pages and navigation at 320px, 390px, 768px, and 1280px, with light and dark themes. Checked full training and feature layouts, footer, overflow, keyboard preview tabs, Escape/focus return, FAQ expansion, and invalid-email handling. Fixed mobile email input height found during this pass.
- No live waitlist subscription, production deployment, authenticated workspace flow, native runtime, Lighthouse/Core Web Vitals measurement, or subdomain migration was performed. Workflow illustrations are explicitly labelled and are not claims of actual recorded app output.
