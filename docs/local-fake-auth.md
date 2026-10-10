# Local fake auth

Signed-in Studio screens can be driven on localhost without a Clerk account.
With `YAPPER_FAKE_AUTH=1`, `next.config.ts` aliases `@clerk/nextjs` and
`@clerk/nextjs/server` to `src/dev/fake-clerk/`, which treats every request as
one local test user. Nothing talks to Clerk.

```bash
YAPPER_FAKE_AUTH=1 npx next dev -p 3112
```

The `.claude/launch.json` entry `yapper-dev-fake-auth` runs the same thing.

The test user is `user_local_test`. Set `NEXT_PUBLIC_YAPPER_FAKE_AUTH_USER_ID`
to act as another user id; that user's real rows are then read and written.

Things to know:

- It uses whatever database `.env.local` points at. If that is production,
  the test user's ideas and views land in production under `user_local_test`.
- Clerk's sign-in and sign-up widgets render a note instead of a form, so check
  the sign-in page on the normal dev server.
- `clerkClient()` throws, so the phone handoff and native ticket routes do not
  work in this mode.
- The shim throws if it is ever loaded with `NODE_ENV=production`, and
  `scripts/validate-deploy-env.mjs` refuses a build with the flag set.
