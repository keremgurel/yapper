# Testing a change

Every change gets tested on dev before it merges and on prod after it deploys,
signed in as the same test account. A PR's testing steps should be something
Kerem can follow without reading the diff or setting anything up.

## The test account

Sign in as `the.ypr.app+clerk_test@gmail.com`.

|                | Dev                            | Prod                                                      |
| -------------- | ------------------------------ | --------------------------------------------------------- |
| Site           | `http://localhost:3000`        | `https://ypr.app`                                         |
| Clerk instance | development (`pk_test`)        | `clerk.ypr.app`                                           |
| Sign-in code   | `424242`, and no email is sent | a real code, delivered to the the.ypr.app@gmail.com inbox |

Clerk treats any `+clerk_test` address on a development instance as a test
address. Production treats it as an ordinary address, and Gmail delivers it to
the.ypr.app@gmail.com. Speaking Practice uses the same address on its own Clerk
instances.

Dev and prod are separate Clerk users with separate data. Create the dev one
with `npm run test-account`; dev sign-up asks for a password and the script
skips that. On prod, sign up with the address the first time.

For sign-up checks on dev, use a new address such as
`signup-1+clerk_test@example.com`. The code is still 424242.

## Dev

In a worktree, link the ignored `.env.local` from the main checkout and install
dependencies first:

```bash
bash scripts/link-worktree-env.sh
```

```bash
npm ci
```

Then run `npm run dev`, open `/sign-in` and sign in with the test account and 424242. Local dev uses whatever database `.env.local` points at, so the test
account's ideas and videos land there (see [local fake auth](local-fake-auth.md)).

Running another app's dev server in the same browser can break Clerk sign-in
on `localhost`, because cookies ignore the port. If the form never appears and
the server logs "infinite redirect loop", clear the cookies for `localhost`.

Preview deployments are switched off, because Clerk does not accept the
generated preview domains. For a quick signed-in look at a screen without
Clerk, [local fake auth](local-fake-auth.md) still works, but test the real
sign-in path with this account.

## Prod

After the deploy finishes, open the page on ypr.app, sign in as the test
account and take the code from the the.ypr.app@gmail.com inbox. The session
persists, so later checks in the same browser skip this step.

Agents never sign in on prod. Open the Browser pane on the page, ask Kerem to
sign in as the test account, then run the steps in that pane.

The test account's prod events reach PostHog like anyone else's. Exclude emails
containing `+clerk_test` when reading numbers.

## Credits

There is no manual grant. Credits come from the welcome grant and Stripe. If a
check on prod needs a purchase, ask Kerem first.

## Testing steps in a PR

Fill the PR's testing section like this:

```
Account: the.ypr.app+clerk_test@gmail.com (dev code 424242)

Dev, run by <who>:
1. Open http://localhost:3000/<page>, signed in. Expect ...
2. ...

Prod, after deploy:
1. Open https://ypr.app/<page>, signed in. Expect ...
```

Give the URL, the starting state, what to click and what should happen, plus
one check that something nearby still works. Mark each step run or not run.
A missing Clerk setup is never a reason to skip dev: everything it needs is on
this page. If a step really can't run, name the blocker and the command that
would clear it.
