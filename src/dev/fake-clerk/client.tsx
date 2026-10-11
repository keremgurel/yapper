"use client";

import type { ReactNode } from "react";
import { FAKE_USER } from "./identity";

/** Stand-in for `@clerk/nextjs` under YAPPER_FAKE_AUTH: always signed in as
 * the local test user, and the sign-in widgets render a note instead. */

const email = { id: "idn_local_test", emailAddress: FAKE_USER.email };
const user = {
  id: FAKE_USER.id,
  firstName: FAKE_USER.firstName,
  lastName: FAKE_USER.lastName,
  fullName: `${FAKE_USER.firstName} ${FAKE_USER.lastName}`,
  imageUrl: "",
  hasImage: false,
  emailAddresses: [email],
  primaryEmailAddress: email,
  primaryEmailAddressId: email.id,
  publicMetadata: {},
  unsafeMetadata: {},
};
const noop = () => {};
const asyncNoop = async () => {};

export function ClerkProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useUser() {
  return { isLoaded: true, isSignedIn: true, user } as const;
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: user.id,
    sessionId: "sess_local_test",
    getToken: async () => null,
    signOut: asyncNoop,
  } as const;
}

export function useClerk() {
  return {
    user,
    loaded: true,
    signOut: asyncNoop,
    openSignIn: noop,
    openSignUp: noop,
    openUserProfile: noop,
  };
}

export function useSignIn() {
  return { isLoaded: true, signIn: null, setActive: asyncNoop } as const;
}

export function Show({
  when,
  children,
}: {
  when: "signed-in" | "signed-out";
  children: ReactNode;
}) {
  return when === "signed-in" ? <>{children}</> : null;
}

function FakeAuthNote() {
  return (
    <p className="text-muted-foreground rounded-xl border p-4 text-sm">
      Local fake auth is on, so you are already signed in as {user.fullName}.
    </p>
  );
}

export const SignIn = FakeAuthNote;
export const SignUp = FakeAuthNote;

export function SignInButton({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
export const SignUpButton = SignInButton;
