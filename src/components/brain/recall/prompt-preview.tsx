"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import BudgetMeter from "@/components/brain/recall/budget-meter";
import { Section } from "@/components/studio-ui";
import { useBrainPreview } from "@/hooks/use-brain-preview";
import { PREVIEW_SURFACES } from "@/lib/brain/preview-client";
import type { BrainSurface } from "@/lib/db/schema";

/**
 * What the AI reads, verbatim.
 *
 * This is the piece that makes a free-form brain trustworthy. A creator who
 * imports a research document and then watches the AI ignore it has no way to
 * tell whether it was dropped, summarised, or read and disregarded, and no
 * amount of explanatory copy fixes that. Showing the compiled text, with the
 * budgets it fit into, answers the question in a glance.
 *
 * The surface picker is here because the answer is genuinely different per
 * surface, and a creator who does not know that will keep wondering why their
 * caption sounds different from their script.
 */
export default function PromptPreview({ version }: { version: number }) {
  const [surface, setSurface] = useState<BrainSurface>("script");
  const { preview, loading, error } = useBrainPreview(surface, version);

  return (
    <Section
      title="What the AI reads"
      action={
        <select
          value={surface}
          aria-label="Which kind of writing"
          onChange={(event) => setSurface(event.target.value as BrainSurface)}
          className="border-border bg-background text-foreground rounded-md border px-2 py-1 text-xs"
        >
          {PREVIEW_SURFACES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      }
    >
      {error ? (
        <p className="text-muted-foreground text-[13px]">
          Could not compile a preview just now.
        </p>
      ) : !preview ? (
        <p className="text-muted-foreground flex items-center gap-2 text-[13px]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Compiling…
        </p>
      ) : (
        <div className={`space-y-4 ${loading ? "opacity-60" : ""}`}>
          <div className="space-y-3">
            <BudgetMeter
              label="Who you are"
              used={preview.core.length}
              total={preview.budget.core}
              hint="Read every single time."
            />
            <BudgetMeter
              label="Listed, not read"
              used={preview.index.length}
              total={preview.budget.index}
              hint="One line each, so the AI knows these exist."
            />
            <BudgetMeter
              label="Pulled in for this"
              used={preview.loaded.length}
              total={preview.budget.loaded}
              hint="Chosen per piece. This preview picks by keyword; the real call asks a model."
            />
          </div>

          {preview.section ? (
            <pre className="bg-muted text-foreground/80 max-h-96 overflow-auto rounded-xl p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {preview.section.trim()}
            </pre>
          ) : (
            <p className="text-muted-foreground text-[13px]">
              Nothing yet. Every prompt runs exactly as it did before you had a
              brain.
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
