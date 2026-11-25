# AI visibility — Yapper

Whether ChatGPT, Google's AI Overviews and AI Mode, and Perplexity name or cite ypr.app for the questions our buyers and readers ask. It sits next to the Search Console scorecards in `../experiments/` and is part of the same weekly measurement loop.

<!-- ai-visibility-tracker:start -->

## Multi-engine tracker (`ai_visibility.py`, since 2026-11-23)

Run from the box by the SEO lead: `cd /workspace/seo-experiments && /workspace/.seo-venv/bin/python ai_visibility.py --site yapper --push`.
It asks every prompt in [`tracked-prompts.json`](tracked-prompts.json) (30 prompts) on four engines through the DataForSEO REST API and writes
[`snapshots/<date>.json`](snapshots/) (normalized, one row per prompt) and [`reports/<date>.md`](reports/) (readable, with changes against the previous run).

| Engine                                             | Endpoint                                             | Cost per prompt |
| -------------------------------------------------- | ---------------------------------------------------- | --------------: |
| ChatGPT (chatgpt.com answer and its sources)       | `ai_optimization/chat_gpt/llm_scraper/live/advanced` |          $0.004 |
| Google organic top 20 + AI Overview (async loaded) | `serp/google/organic/live/advanced`                  |        ~$0.0055 |
| Google AI Mode                                     | `serp/google/ai_mode/live/advanced`                  |          $0.004 |
| Perplexity Sonar, web search on                    | `ai_optimization/perplexity/llm_responses/live`      |         ~$0.006 |

About $0.02 per prompt, so a full run for this site costs about $0.58. Gemini (`--engines ... gemini`) is optional at ~$0.03 per prompt.
LLM Mentions (`ai_optimization/llm_mentions/*`, $0.10+ per call) returned no data for our domains in November 2026, so it is not used.

**How to read it.** _Cited_ means the answer links our domain (the strong signal). _Named_ means the brand appears in the text; _named #n_ is our rank among the tracked brands by first appearance.
_Visible_ is named or cited. _Share of voice_ is our visible-prompt count over the sum for every tracked brand. Google AI Overview sources that come back as `google.com/goto` links are resolved to the real URL.
AI answers vary run to run, so treat a change of one or two prompts as noise; look for moves of three or more, or the same move two runs in a row.

**Comparability.** Prompt ids never change meaning. To retire a prompt, leave it and add a new id. Prompts marked `legacy:` come from the earlier checks in this folder so the series stay comparable.

**Tie-in with experiments.** Each report lists every URL in `../experiments/ledger.jsonl` shipped in the last 150 days with its AI citation count, so a new post or title rewrite can be judged on AI citations as well as Google rank.

### Latest run (2026-11-23)

| Engine             | Cited | Visible | Share of voice |
| ------------------ | ----: | ------: | -------------: |
| ChatGPT            |  1/30 |    1/30 |             2% |
| Google AI Overview |  2/30 |    2/30 |             6% |
| Google AI Mode     |  0/30 |    1/30 |             3% |
| Perplexity         |  5/30 |    5/30 |             9% |

Full report: [reports/2026-11-23.md](reports/2026-11-23.md).

<!-- ai-visibility-tracker:end -->
