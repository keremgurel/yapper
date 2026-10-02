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

Search Console for `sc-domain:ypr.app` is read through the helper in the speaking-coach repo (`marketing/organic/seo/gsc_query.py`). Past pulls and their limits are in `docs/seo/`.

# Pronunciation scoring

Train feedback scores pronunciation and intonation with Azure Speech, in the browser, using a short-lived token from `/api/training/speech-token`. It needs `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` in `.env.local` and in Vercel (resource `yapper-speech` in resource group `yapper-dev-rg`, region `eastus`). Without them the report simply has no pronunciation section. The code is in `src/lib/pronunciation/`.
