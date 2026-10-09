<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Analytics access

Yapper's PostHog project is separate from the CELPIP one, so the PostHog connector may not reach it. Query it directly:

```bash
node scripts/posthog-query.mjs "select event, count() from events where timestamp > now() - interval 7 day group by event order by 2 desc limit 20"
```

It needs `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_ID` in `.env.local` (gitignored, never commit the key). The script only sends SELECT queries. If either value is empty, ask the user to fill it in; do not look for the key elsewhere.

Search Console for `sc-domain:ypr.app` is read through the helper in the celpip-practice repo (`marketing/organic/seo/gsc_query.py`). Past pulls and their limits are in `docs/seo/`.

# Speaking practice

Yapper Train moved to its own product on October 9, 2026: speakingpractice.ai, repo `keremgurel/speaking-practice` (Cloudflare Workers). Its practice stage, feedback and Azure pronunciation scoring live there now. ypr.app 301s the old practice URLs to it; `/history` stays here because it is Studio's video manager.
