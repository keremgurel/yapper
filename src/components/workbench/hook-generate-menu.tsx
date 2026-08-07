"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HOOK_PATTERNS } from "@/lib/content/hook-patterns";

/**
 * Generate hooks, optionally all of one archetype.
 *
 * The pattern picker sits behind a toggle rather than being ten buttons on
 * screen: the common action is "give me a spread", and asking for one specific
 * mechanism is the follow-up you reach for once you have seen what lands.
 */
export default function HookGenerateMenu({
  running,
  disabled,
  onGenerate,
}: {
  running: boolean;
  disabled: boolean;
  onGenerate: (patternId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onGenerate(null)}
          disabled={disabled}
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {running ? "Writing…" : "Generate hooks · 1 credit"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-muted-foreground"
        >
          {open ? "Hide patterns" : "Pick a pattern"}
        </Button>
      </div>

      {open && (
        <div className="flex flex-wrap gap-1.5">
          {HOOK_PATTERNS.map((pattern) => (
            <Button
              key={pattern.id}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onGenerate(pattern.id)}
              title={`${pattern.mechanism} Use when: ${pattern.whenToUse}`}
              className="h-7 text-xs"
            >
              {pattern.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
