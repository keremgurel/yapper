import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

/** What /progress shows before sign-in: the pitch is the record itself. */
export default function ProgressSignedOut() {
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="font-display text-foreground text-[22px] font-bold tracking-[-0.01em]">
        Your progress
      </h1>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">
        Sign in to see your scores and every past session in one place.
      </p>
      <SignInButton mode="modal" withSignUp>
        <Button>Sign in</Button>
      </SignInButton>
    </div>
  );
}
