"use client";

import { useState } from "react";
import { Check, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StepShell from "@/components/onboarding/step-shell";

const SUGGESTIONS = [
  "Educational",
  "Storytelling",
  "Hooks & openers",
  "Behind the scenes",
  "Tips & how-to",
  "Hot takes",
];

/** Content pillars step: pick/add your pillars, OR tell us you're not sure and
 * we'll derive them from your recent videos later. One of the two must be true
 * to continue. */
export default function StepPillars({
  stepIndex,
  pillars,
  onChangePillars,
  wantsHelp,
  onChangeWantsHelp,
  onBack,
  onNext,
  onSkip,
}: {
  stepIndex: number;
  pillars: string[];
  onChangePillars: (next: string[]) => void;
  wantsHelp: boolean;
  onChangeWantsHelp: (next: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [draft, setDraft] = useState("");

  const add = (name: string) => {
    const v = name.trim();
    if (!v || pillars.includes(v)) return;
    onChangePillars([...pillars, v]);
    onChangeWantsHelp(false);
  };
  const remove = (name: string) =>
    onChangePillars(pillars.filter((p) => p !== name));

  const canContinue = pillars.length > 0 || wantsHelp;

  return (
    <StepShell
      stepIndex={stepIndex}
      title="What are your content pillars?"
      subtitle="The 3–5 themes your videos keep coming back to. We use these to sort every idea you capture. Not sure? Skip it — you can set these up later."
      onBack={onBack}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            size="lg"
            onClick={onNext}
            disabled={!canContinue}
          >
            Continue
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground w-full"
            onClick={onSkip}
          >
            I&apos;ll set these up later
          </Button>
        </div>
      }
    >
      {/* Selected pillars */}
      {pillars.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {pillars.map((p) => (
            <span
              key={p}
              className="text-foreground inline-flex items-center gap-1.5 rounded-md bg-[color:var(--sg-accent)]/15 px-2.5 py-1 text-sm font-semibold"
            >
              {p}
              <button
                type="button"
                onClick={() => remove(p)}
                aria-label={`Remove ${p}`}
                className="text-foreground/50 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add custom */}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
              setDraft("");
            }
          }}
          placeholder="Add a pillar, e.g. Personal finance"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            add(draft);
            setDraft("");
          }}
          aria-label="Add pillar"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Suggestions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.filter((s) => !pillars.includes(s)).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => add(s)}
            className="border-border text-foreground/80 hover:bg-muted inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm font-semibold"
          >
            <Plus className="h-3 w-3" />
            {s}
          </button>
        ))}
      </div>

      {/* Help toggle */}
      <button
        type="button"
        onClick={() => onChangeWantsHelp(!wantsHelp)}
        className={`mt-4 flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors ${
          wantsHelp
            ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)]/10"
            : "border-border hover:bg-muted"
        }`}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
            wantsHelp
              ? "bg-[color:var(--sg-accent)] text-white"
              : "bg-muted text-foreground/70"
          }`}
        >
          {wantsHelp ? (
            <Check className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </span>
        <span>
          <span className="text-foreground block text-sm font-bold">
            Help me find my pillars
          </span>
          <span className="text-muted-foreground block text-xs">
            We&apos;ll transcribe your recent videos and suggest them.
          </span>
        </span>
      </button>
    </StepShell>
  );
}
