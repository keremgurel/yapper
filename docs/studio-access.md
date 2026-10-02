# Studio access: the private beta and the team password

Studio is open to approved beta testers and to the team. Testers get in with a
personal access code; the team keeps a shared password. Both end in the same
cookie check in `src/proxy.ts`, and Clerk sign-in still applies afterwards.

## The private beta

1. Someone applies with the form on `/products/studio#waitlist`
   (`POST /api/studio-beta/apply`). It stores a row in
   `studio_beta_applications`: name, email, where they post, what they want to
   make. Applying twice with one email keeps the first row.
2. An admin opens `/studio/admin/beta`. Admins are the Clerk ids in
   `ADMIN_USER_IDS`; everyone else gets a 404.
3. Approving issues a personal access code (three groups of four characters),
   stores only its hash, and emails the invitation: the code, the link to
   `/studio-access`, and the Mac app download. The panel shows the code once.
4. The tester enters their email and code on `/studio-access`. The cookie they
   get names their application and expiry and is signed with the access
   secret, so the proxy checks it without a database read. It lasts 30 days.
5. Revoking sets the application to `revoked` and clears the code. The Studio
   layout checks a tester cookie against the database on each page load, so a
   revoked tester is sent back to `/studio-access` on their next request.
   "Send a new code" replaces the old code; a tester already inside stays in
   until their cookie expires.

The code is bound to the email it was issued for, and the access form does not
say whether the email or the code was wrong. Attempts are rate limited per IP
(see below).

### Email

Invitations go out through Resend from `STUDIO_BETA_FROM_EMAIL`, which must be
on a domain verified in Resend. Until that variable is set, nothing is sent:
approving still works, and the panel tells the admin to pass the code on by
hand. `STUDIO_BETA_REPLY_TO` is optional.

### What is not gated

The Mac app download is a public GitHub release, and the native shell skips
the cookie gate (see the exemptions below). The beta gate keeps the public out
of the web Studio; Clerk and the paid entitlement are what protect the API.

## The team password

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
`STUDIO_ACCESS_PASSWORD` invalidates every outstanding cookie at once,
including testers' cookies, which are signed with the same secret. Testers
then enter their code again. That is
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
