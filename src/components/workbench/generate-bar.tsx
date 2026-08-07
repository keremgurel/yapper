"use client";

import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GenError } from "@/hooks/use-idea-generation";

/** Rebuild the hooks and the body from the title. Separate from the script
 * control, which costs more and is opted into on its own. */
export default function GenerateBar({
  title,
  running,
  disabled,
  error,
  onGenerate,
}: {
  title: string;
  running: boolean;
  disabled: boolean;
  error: GenError;
  onGenerate: () => void;
}) {
  const ready = Boolean(title.trim());
  const ideaError = error?.action === "idea" ? error.kind : null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Show when="signed-in">
        <Button
          type="button"
          onClick={onGenerate}
          disabled={disabled || !ready}
          title={ready ? "Generate with AI" : "Add a title first"}
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {running ? "Generating…" : "Generate with AI · 1 credit"}
        </Button>
      </Show>
      <Show when="signed-out">
        <SignInButton mode="modal" withSignUp>
          <Button type="button">
            <Sparkles className="h-4 w-4" />
            Sign in to generate
          </Button>
        </SignInButton>
      </Show>

      {ideaError === "locked" && (
        <Button asChild variant="link" className="h-auto p-0">
          <Link href="/pricing">Subscribe to unlock AI generation</Link>
        </Button>
      )}
      {ideaError === "insufficient" && (
        <span className="text-sm font-semibold text-amber-500">
          Out of credits. Top up to keep generating.
        </span>
      )}
      {ideaError === "failed" && (
        <span className="text-destructive text-sm font-semibold">
          Generation failed. No credit charged. Try again.
        </span>
      )}
    </div>
  );
}
