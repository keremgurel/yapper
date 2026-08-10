import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { ChirpyMark } from "@/components/brand/chirpy-mark";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

/**
 * Sign-in as the desktop app shows it, in its own window.
 *
 * The app used to send every sign-in to the system browser, which meant leaving
 * the app to type an email address. Email and password work perfectly inside
 * the app's web view, so they happen here; only Google and Apple need a real
 * browser, and the app intercepts those and opens one.
 *
 * `routing="hash"` keeps every step of Clerk's flow on this one path, so the
 * shell never sees a route it does not recognise mid-sign-in.
 */
export default function Page() {
  return (
    <main className="bg-background flex min-h-svh flex-col items-center justify-center gap-7 p-6">
      <div className="flex flex-col items-center gap-3">
        <ChirpyMark size={44} />
        <div className="text-center">
          <p className="font-display text-2xl font-black">Yapper Studio</p>
          <p className="text-muted-foreground text-sm">
            Sign in to reach your projects, ideas and connected accounts.
          </p>
        </div>
      </div>

      <SignIn
        routing="hash"
        forceRedirectUrl="/studio/home"
        fallbackRedirectUrl="/studio/home"
      />
    </main>
  );
}
