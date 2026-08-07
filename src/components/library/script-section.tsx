"use client";

import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Section from "@/components/workbench/section";
import { scriptMeter } from "@/lib/content/script-meter";
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
  const meter = scriptMeter(idea.script);
  const label = idea.script?.trim()
    ? "Regenerate · 2 credits"
    : "Write full script · 2 credits";

  return (
    <Section
      title="Script"
      meta={meter.words ? `~${meter.label} · ${meter.words} words` : undefined}
      action={
        <>
          <Show when="signed-in">
            {/* Outline, not the accent fill. Record is the one primary action on
              this screen; three competing orange buttons taught you to ignore
              all of them. */}
            <Button
              type="button"
              variant="outline"
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
        </>
      }
    >
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
      {/* The hero of the page, and treated like one: larger than everything
          else, set to a reading measure rather than the full column width, and
          on a raised surface with no visible input chrome. A script you will
          read aloud off a teleprompter should look like prose, not a form
          field 130 characters wide. */}
      <div className="bg-card border-border/60 rounded-xl border p-5 sm:p-6">
        <Textarea
          value={idea.script ?? ""}
          rows={10}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Generate a full spoken-word script, or write your own. This is what you'll read off the teleprompter."
          className="text-foreground max-w-[68ch] resize-none border-0 bg-transparent p-0 text-[17px] leading-[1.75] shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
    </Section>
  );
}
