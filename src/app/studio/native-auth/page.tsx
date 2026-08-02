"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { ChirpyMark } from "@/components/brand/chirpy-mark";

/**
 * Browser half of the native sign-in handoff. Credentials and OAuth stay in
 * the user's system browser; after Clerk has a browser session, a short-lived
 * one-time ticket returns that identity to the native app.
 */
function NativeAuthContent() {
  const { isLoaded, isSignedIn } = useAuth();
  const searchParams = useSearchParams();
  const state = searchParams.get("state") ?? "";
  const returnPath = `/studio/native-auth?state=${encodeURIComponent(state)}`;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !state) return;
    window.location.replace(
      `/studio/native-auth/ticket?state=${encodeURIComponent(state)}`,
    );
  }, [isLoaded, isSignedIn, state]);

  if (!state) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <p className="text-destructive text-sm">
          This sign-in link is incomplete. Start again from Yapper Studio.
        </p>
      </main>
    );
  }

  return (
    <main className="bg-background flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <ChirpyMark size={38} />
          <div>
            <p className="font-display text-xl font-black">Yapper Studio</p>
            <p className="text-muted-foreground text-sm">
              Secure browser sign-in
            </p>
          </div>
        </div>

        {isLoaded && isSignedIn ? (
          <div className="border-border bg-card w-full rounded-xl border p-8 text-center shadow-sm">
            <p className="font-semibold">Finishing sign-in…</p>
            <p className="text-muted-foreground mt-2 text-sm">
              You’ll return to Yapper Studio automatically.
            </p>
          </div>
        ) : (
          <SignIn
            routing="hash"
            forceRedirectUrl={returnPath}
            signUpForceRedirectUrl={returnPath}
          />
        )}
      </div>
    </main>
  );
}

export default function NativeAuthPage() {
  return (
    <Suspense fallback={null}>
      <NativeAuthContent />
    </Suspense>
  );
}
