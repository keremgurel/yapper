// Makes sure the manual test account exists on the DEV Clerk instance, then
// prints how to sign in as it. See docs/testing.md.
//
// Dev only. Clerk treats a "+clerk_test" address on a development instance as
// a test address: no email is sent and the code is always 424242. Creating the
// user here skips the sign-up form, which would otherwise ask for a password.

const EMAIL = "the.ypr.app+clerk_test@gmail.com";
const SIGN_IN_URL = "http://localhost:3000/sign-in";

const key = process.env.CLERK_SECRET_KEY ?? "";
if (!key.startsWith("sk_test_")) {
  console.error(
    "CLERK_SECRET_KEY is missing or is not a development (sk_test_) key.\n" +
      "In a worktree, run `bash scripts/link-worktree-env.sh` first.",
  );
  process.exit(1);
}

async function clerk(path, init = {}) {
  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Clerk ${init.method ?? "GET"} ${path} failed: ${response.status} ${await response.text()}`,
    );
  }
  return response.json();
}

const found = await clerk(`/users?email_address=${encodeURIComponent(EMAIL)}`);
const existing = (Array.isArray(found) ? found : (found.data ?? []))[0];
const user =
  existing ??
  (await clerk("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [EMAIL],
      first_name: "Test",
      last_name: "Account",
      skip_password_requirement: true,
    }),
  }));

console.log(
  `${existing ? "Found" : "Created"} ${EMAIL} (${user.id}) on the dev instance.\n` +
    `Sign in at ${SIGN_IN_URL} with that email and the code 424242.`,
);
