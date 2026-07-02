"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import { Loader2, Sparkles } from "lucide-react";
import type { GenErrorKind } from "@/hooks/use-idea-generation";
import type { Idea } from "@/lib/inspiration/ideas";

const genBtn =
  "inline-flex items-center gap-1.5 rounded-full bg-cyan-500 px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-cyan-600 disabled:opacity-50";

/** Full-script field with its own generate control. Render-only — the parent
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
  idea: Idea;
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
        <p className="text-foreground/45 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
          Full script
        </p>
        <Show when="signed-in">
          <button
            type="button"
            onClick={onGenerate}
            disabled={disabled || !idea.title.trim()}
            className={genBtn}
            title={
              idea.title.trim() ? "Generate a script" : "Add a title first"
            }
          >
            {generating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {generating ? "Writing…" : label}
          </button>
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal" withSignUp>
            <button type="button" className={genBtn}>
              <Sparkles className="h-3 w-3" />
              Sign in to write
            </button>
          </SignInButton>
        </Show>
      </div>
      {error === "insufficient" && (
        <p className="mb-2 text-[12px] font-bold text-amber-500">
          Out of credits — top up to keep generating.
        </p>
      )}
      {error === "failed" && (
        <p className="mb-2 text-[12px] font-bold text-red-500">
          Script generation failed — no credit charged. Try again.
        </p>
      )}
      <textarea
        value={idea.script ?? ""}
        rows={8}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Generate a full spoken-word script, or write your own — this is what you'll read off the teleprompter."
        className="border-border bg-background text-foreground focus:border-foreground/40 w-full resize-y rounded-lg border px-3 py-2 text-sm leading-6 outline-none"
      />
    </div>
  );
}
