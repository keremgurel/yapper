<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Package manager

Use pnpm, not npm or yarn. In a new worktree run `pnpm install` after `bash scripts/link-worktree-env.sh`. pnpm links packages from one shared store (`~/Library/pnpm/store`) instead of writing another full copy, so an extra worktree no longer costs the 1.3 GB of `node_modules` that npm wrote. `npm install` fails on purpose (`scripts/require-pnpm.mjs`). If it ran anyway, delete the `node_modules` and `package-lock.json` it left behind and run `pnpm install`.

- Add a dependency with `pnpm add <name>` or `pnpm add -D <name>`. Run scripts with `pnpm run <script>` and binaries with `pnpm exec <bin>`.
- pnpm skips dependency install scripts that are not listed in `pnpm-workspace.yaml`. When it reports an ignored build script for a new dependency, read the script, then add the package to `onlyBuiltDependencies` if it needs to run or to `ignoredBuiltDependencies` if it does not.
- `workers/publish-clock` has its own lockfile. Install it from that folder and deploy with `pnpm run deploy`, since `pnpm deploy` is a different built-in command.

# Testing a change

- Follow `docs/testing.md`. Test on dev before opening the PR and write the prod steps for after deploy, using `the.ypr.app+clerk_test@gmail.com` on dev (code 424242) and `the.ypr.app+qa@gmail.com` on prod (real email verification). Do not use Clerk’s reserved test-address suffix in production.
- In a worktree, run `bash scripts/link-worktree-env.sh` first. A worktree without `.env.local` is not a reason to skip signed-in checks.
- Never sign in on prod yourself. Ask Kerem to sign the Browser pane in as the test account, then drive it.

# Analytics access

Yapper's PostHog project is separate from the CELPIP one, so the PostHog connector may not reach it. Query it directly:

```bash
node scripts/posthog-query.mjs "select event, count() from events where timestamp > now() - interval 7 day group by event order by 2 desc limit 20"
```

It needs `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_ID` in `.env.local` (gitignored, never commit the key). The script only sends SELECT queries. If either value is empty, ask the user to fill it in; do not look for the key elsewhere.

Search Console for `sc-domain:ypr.app` is read through the helper in the celpip-practice repo (`marketing/organic/seo/gsc_query.py`). Past pulls and their limits are in `docs/seo/`.

# Speaking practice

Yapper Train moved to its own product on October 9, 2026: speakingpractice.ai, repo `keremgurel/speaking-practice` (Cloudflare Workers). Its practice stage, feedback and Azure pronunciation scoring live there now. ypr.app 301s the old practice URLs to it; `/history` stays here because it is Studio's video manager.
