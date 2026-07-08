"use client";

import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { GenErrorKind } from "@/hooks/use-idea-generation";

/** The two fields this section reads; Idea and ContentDetail both satisfy it. */
interface ScriptFields {
  title: string;
  script?: string | null;
}

/** Full-script field with its own generate control. Render-only, the parent
 * owns generation state and persistence. `generating` is true only while the
 * script itself is being written (drives the spinner); `disabled` is true while
 * any generation is in flight (so a script run can't start mid-idea-run and
 * double-charge). */
export default function ScriptSection({
  idea,
  generating,
  disabled,
  error,
  onGenerate,
  onChange,
}: {
  idea: ScriptFields;
  generating: boolean;
  disabled: boolean;
  error: GenErrorKind | null;
  onGenerate: () => void;
  onChange: (script: string) => void;
}) {
  const label = idea.script?.trim()
    ? "Regenerate · 2 credits"
    : "Write full script · 2 credits";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="sg-field-label">Full script</p>
        <Show when="signed-in">
          <Button
            type="button"
            size="sm"
            onClick={onGenerate}
            disabled={disabled || !idea.title.trim()}
            title={
              idea.title.trim() ? "Generate a script" : "Add a title first"
            }
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? "Writing…" : label}
          </Button>
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal" withSignUp>
            <Button type="button" size="sm">
              <Sparkles className="h-4 w-4" />
              Sign in to write
            </Button>
          </SignInButton>
        </Show>
      </div>
      {error === "locked" && (
        <Button asChild variant="link" className="mb-2 h-auto p-0">
          <Link href="/pricing">Subscribe to unlock AI scripts</Link>
        </Button>
      )}
      {error === "insufficient" && (
        <p className="mb-2 text-sm font-semibold text-amber-500">
          Out of credits. Top up to keep generating.
        </p>
      )}
      {error === "failed" && (
        <p className="text-destructive mb-2 text-sm font-semibold">
          Script generation failed. No credit charged. Try again.
        </p>
      )}
      <Textarea
        value={idea.script ?? ""}
        rows={8}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Generate a full spoken-word script, or write your own. This is what you'll read off the teleprompter."
        className="leading-6"
      />
    </div>
  );
}
