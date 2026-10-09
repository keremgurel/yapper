"use client";

import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";

import UserMenu from "@/components/account/user-menu";
import { Button } from "@/components/ui/button";

/**
 * Account controls for the public site header. Training feedback costs a
 * credit, so signing in has to be reachable from every marketing and practice
 * page, not only from Studio. Signed-in visitors get the same credit meter and
 * account menu the Studio header shows.
 */
export default function SiteAccountControls({
  showSignup = true,
  showSignIn = true,
}: {
  showSignup?: boolean;
  showSignIn?: boolean;
}) {
  return (
    <>
      <Show when="signed-out">
        {showSignIn && (
          <SignInButton mode="modal">
            <Button type="button" size="sm" variant="ghost">
              Sign in
            </Button>
          </SignInButton>
        )}
        {showSignup && (
          <SignUpButton mode="modal">
            <Button type="button" size="sm" className="hidden sm:inline-flex">
              Start free
            </Button>
          </SignUpButton>
        )}
      </Show>
      <Show when="signed-in">
        <UserMenu />
      </Show>
    </>
  );
}
