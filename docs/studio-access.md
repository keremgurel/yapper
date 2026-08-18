# Studio access password

Studio is unfinished, but the marketing site, the training tools and AI
feedback around it are live and take payment. So the deployment cannot sit
behind Vercel's project-level password, which is all-or-nothing per deployment.
Instead a shared password gates the `/studio/*` subtree only.

## How it works

`STUDIO_ACCESS_PASSWORD` is the whole switch. When it is unset the gate does
not exist and Studio behaves exactly as it did before, which keeps local dev
and preview builds frictionless.

When it is set:

1. `src/proxy.ts` checks for the `yapper_studio_access` cookie on every
   `/studio/*` request, before Clerk runs. An outsider never sees a sign-in
   form for a product they should not know is there.
2. A missing or stale cookie redirects to `/studio-access?next=<path>`, which
   renders a password form.
3. `POST /api/studio-access` verifies the password and sets the cookie for 30
   days, `HttpOnly`, `SameSite=Lax`, `Secure` in production.
4. Clerk sign-in still applies afterwards. The password answers "should anyone
   outside the team be in here yet"; Clerk still answers "who are you".

The cookie never contains the password. It carries an HMAC-SHA256 over a fixed
label keyed by the password, so a stolen cookie reveals nothing, and changing
`STUDIO_ACCESS_PASSWORD` invalidates every outstanding cookie at once. That is
the rotation procedure: change the variable, redeploy, and hand out the new
password.

## Rate limiting

A single shared secret with unlimited attempts is guessable, so
`guardStudioAccessIp` in `src/lib/public-rate-limit.ts` allows 5 attempts per
IP with a 10-per-hour refill. This depends on the same
`RATE_LIMIT_SUBJECT_SECRET` and `RATE_LIMIT_TRUST_PROXY` configuration the rest
of the limiter uses (see `docs/rate-limiting.md`).

## Two deliberate exemptions

`/studio/native-auth*` and `/studio/handoff` skip the gate, as do requests whose
User-Agent contains `YapperStudioNative/`. Both exemptions predate this gate and
exist so the desktop app can establish its own Clerk session; gating them would
break the native shell.

The consequence is worth stating plainly: **spoofing that User-Agent bypasses
the password.** It does not bypass Clerk, and every API route is still
`auth.protect()`ed, so the attacker gets a signed-out shell and nothing else.
If Studio ever holds something worth hiding from a determined visitor rather
than from the public at large, the native shell needs its own credential and
this exemption should go.

## Setting it

```
vercel env add STUDIO_ACCESS_PASSWORD production
vercel env add STUDIO_ACCESS_PASSWORD preview
```

Leave it unset locally unless you are specifically testing the gate.
