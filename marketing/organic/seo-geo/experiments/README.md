# SEO experiment ledger

This folder is the source of truth for SEO changes shipped on **Yapper** (`ypr.app`).

The box scripts in `/workspace/seo-experiments` read and write these files, then can commit and push to `main`. The copy on the box is only a cache.

## Files

- `ledger.jsonl` — one JSON object per change: ship date (Pacific), URL(s), type, commit SHA, hypothesis, target queries, a 28-day Search Console baseline (page, queries and site total) and the review dates.
- `reports/` — evaluations (`YYYY-MM-DD.md` / `.json`) and weekly scorecards (`scorecard-YYYY-MM-DD.md` / `.json`).

## Waiting rules

| Change type | First look | Final judgment |
|---|---|---|
| `title_meta`, `content_refresh`, `data_refresh`, `internal_links` | 4 weeks | 8 weeks |
| `new_post`, `tool_page` | 4-week *read* (not a verdict) | 12 weeks |
| `redirect` | 2 weeks (coverage / indexing) | 4 weeks |

Search Console finalized data lags 2–3 days. A window with fewer than about 100 impressions is inconclusive. Official verdicts are never issued before the first review date. Recommended actions (`keep`, `iterate`, `revert`, `expand the pattern`) are advice only — do not revert a live page without an explicit go-ahead.

## How to log a change

As soon as a post, title/meta edit, refresh, redirect or tool page is *live*:

```bash
source /workspace/.seo-venv/bin/activate
cd /workspace/seo-experiments
python log_change.py \
  --site yapper \
  --url https://ypr.app/blog/some-new-post \
  --type new_post \
  --sha <commit> \
  --shipped-date YYYY-MM-DD \
  --hypothesis "What this should do, and for which queries." \
  --queries "primary query, secondary query" \
  --push
```

If a page is committed but not yet deployed (SpeakingPractice.ai guides, for example), log it on the live date, not the commit date.

Evaluate and write the weekly scorecard from the same directory, with `--push` so this folder stays current:

```bash
python evaluate.py --all --push
python scorecard.py --push
```
