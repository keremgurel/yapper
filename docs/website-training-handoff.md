# Website and training handoff

October 1, 2026. This release brings the public website, Studio demonstrations,
Train product page, and shared training workspace onto the current main branch.
It preserves main's newer storage, provider-cost, and billing safeguards.

## Follow-up direction

Yapper Studio and Yapper Train will have separate marketing journeys, pricing,
and entitlements under ypr.app. The root page will introduce both products.
Research keyword ownership and existing search performance before choosing new
public routes. The exact `/studio` route currently redirects to
`/products/studio`; its authenticated descendants must remain protected.

The product separation and fresh quantitative SEO research are follow-up work,
not completed by this baseline. Earlier architecture documents describe earlier
iterations and should be reconciled with this direction.

## Preserved pricing draft

The original website and shared-credit pricing work is preserved on
`codex/website-pricing-checkpoint`, commit
`b624e0cfafa898ec56127f42cdfe59ddf5cbdd62`.

That branch is an archival checkpoint based on an older main. Do not merge or
cherry-pick the whole checkpoint: it predates current cost controls and its
shared Studio/Train subscription is superseded by the product separation.
Its pricing layouts and `docs/pricing-2026-10.md` are available as references.
Validate new product-specific economics against current provider costs and
preserve existing billing safeguards and legacy subscriber handling.

## Working safely

Start the next implementation branch from main after this release is merged.
Use a fresh checkout/worktree: the original checkout still contains unrelated
and previously overlapping local work. Nothing in that checkout was reset.

The build script includes a production migration hook. Use `npx next build`
for local compilation without invoking that hook. Do not copy production
credentials into a test checkout or mutate live billing as part of a UI change.
