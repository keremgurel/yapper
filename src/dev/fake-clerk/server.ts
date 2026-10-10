import { NextResponse, type NextRequest } from "next/server";
import { FAKE_USER } from "./identity";

/** Stand-in for `@clerk/nextjs/server` under YAPPER_FAKE_AUTH. Every request
 * is the local test user; nothing talks to Clerk. */

function authObject() {
  return {
    userId: FAKE_USER.id,
    sessionId: "sess_local_test",
    orgId: null,
    getToken: async () => null,
    has: () => true,
    redirectToSignIn: () => {
      throw new Error("fake auth is always signed in");
    },
  };
}

type FakeAuth = (() => Promise<ReturnType<typeof authObject>>) & {
  protect: () => Promise<ReturnType<typeof authObject>>;
};

export const auth: FakeAuth = Object.assign(async () => authObject(), {
  protect: async () => authObject(),
});

export async function currentUser() {
  const email = { id: "idn_local_test", emailAddress: FAKE_USER.email };
  return {
    id: FAKE_USER.id,
    firstName: FAKE_USER.firstName,
    lastName: FAKE_USER.lastName,
    fullName: `${FAKE_USER.firstName} ${FAKE_USER.lastName}`,
    imageUrl: "",
    emailAddresses: [email],
    primaryEmailAddress: email,
    primaryEmailAddressId: email.id,
    publicMetadata: {},
    privateMetadata: {},
    unsafeMetadata: {},
  };
}

export async function clerkClient(): Promise<never> {
  throw new Error("clerkClient is not available under fake auth");
}

/** Clerk's patterns here only use `(.*)`, so a plain regex covers them. */
export function createRouteMatcher(patterns: string[]) {
  const regexes = patterns.map(
    (p) =>
      new RegExp(
        `^${p.replace(/[.+?^${}|[\]\\]/g, "\\$&").replace(/\(\\\.\*\)/g, "(.*)")}$`,
      ),
  );
  return (req: NextRequest) =>
    regexes.some((r) => r.test(req.nextUrl.pathname));
}

export function clerkMiddleware(
  handler?: (a: FakeAuth, req: NextRequest) => unknown,
) {
  return async (req: NextRequest) => {
    await handler?.(auth, req);
    return NextResponse.next();
  };
}
