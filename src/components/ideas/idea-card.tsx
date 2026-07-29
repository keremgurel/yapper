"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import type { Idea, IdeaType } from "@/lib/ideas/types";

const TYPE_LABEL: Record<IdeaType, string> = {
  original: "Original",
  "semi-original": "Semi-original",
  inspiration: "Inspiration",
};

export default function IdeaCard({
  idea,
  selected,
  expanding,
  onToggle,
  onRetry,
}: {
  idea: Idea;
  selected: boolean;
  expanding: boolean;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const e = idea.expansion;
  const title =
    e?.title ||
    firstLine(idea.originalTranscript) ||
    idea.source?.url ||
    "New idea";

  return (
    <div
      className={`border-border bg-card rounded-xl border transition-colors ${
        selected ? "border-[color:var(--sg-accent)]/60" : ""
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={onToggle}
          aria-label={selected ? "Deselect" : "Select"}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
            selected
              ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-white"
              : "border-border hover:border-foreground/40"
          }`}
        >
          {selected && <Check className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-[color:var(--sg-accent)]/12 px-2 py-0.5 text-[11px] font-bold text-[color:var(--sg-accent)]">
              {TYPE_LABEL[idea.type]}
            </span>
            {expanding && (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Expanding
              </span>
            )}
          </div>
          <p className="text-foreground truncate text-[15px] font-bold">
            {title}
          </p>
          {e?.pillar && (
            <p className="text-muted-foreground mt-0.5 text-xs">{e.pillar}</p>
          )}
        </button>

        <ChevronDown
          className={`text-muted-foreground mt-1 h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <div className="border-border space-y-4 border-t px-4 py-4 text-sm">
          <Section label="Your words">
            <p className="text-foreground/80 whitespace-pre-wrap">
              {idea.originalTranscript || idea.source?.url || "(none)"}
            </p>
          </Section>

          {e ? (
            <>
              {e.hooks.length > 0 && (
                <Section label="Hooks">
                  <ul className="list-disc space-y-1 pl-4">
                    {e.hooks.map((h, i) => (
                      <li key={i} className="text-foreground/80">
                        {h}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              {e.outline.length > 0 && (
                <Section label="Outline">
                  <ol className="list-decimal space-y-1 pl-4">
                    {e.outline.map((o, i) => (
                      <li key={i} className="text-foreground/80">
                        {o}
                      </li>
                    ))}
                  </ol>
                </Section>
              )}
              {e.keyPoints.length > 0 && (
                <Section label="Key points">
                  <ul className="list-disc space-y-1 pl-4">
                    {e.keyPoints.map((p, i) => (
                      <li key={i} className="text-foreground/80">
                        {p}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              {e.script && (
                <Section label="Script">
                  <p className="text-foreground/80 whitespace-pre-wrap">
                    {e.script}
                  </p>
                </Section>
              )}
            </>
          ) : (
            !expanding && (
              <button
                type="button"
                onClick={onRetry}
                className="text-foreground/70 hover:text-foreground flex items-center gap-1.5 text-sm font-semibold"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Expand this idea
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function firstLine(s: string): string {
  const line = s.split(/[.\n]/)[0]?.trim() ?? "";
  return line.length > 90 ? line.slice(0, 90) : line;
}
