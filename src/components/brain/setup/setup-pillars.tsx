"use client";

import type { SetupPillar } from "@/lib/brain/setup";
import type { SetupSelection } from "@/lib/brain/setup-client";

/**
 * The pillars the document lays out, and whether they replace the current
 * list or join it. Replace is the default when a document describes a whole
 * system, because a pillar list is only useful if every idea fits one.
 */
export default function SetupPillars({
  pillars,
  existingCount,
  selection,
  onChange,
}: {
  pillars: SetupPillar[];
  existingCount: number;
  selection: SetupSelection;
  onChange: (next: SetupSelection) => void;
}) {
  if (!pillars.length) return null;
  const toggle = (name: string, on: boolean) => {
    const next = new Set(selection.pillars);
    if (on) next.add(name);
    else next.delete(name);
    onChange({ ...selection, pillars: next });
  };
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="sg-field-label">Pillars</h3>
        {existingCount > 0 && (
          <div
            role="radiogroup"
            aria-label="What to do with the current pillars"
            className="bg-muted inline-flex rounded-lg p-0.5"
          >
            {(
              [
                ["replace", `Replace the ${existingCount} current`],
                ["add", "Add to them"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={selection.pillarMode === mode}
                onClick={() => onChange({ ...selection, pillarMode: mode })}
                className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  selection.pillarMode === mode
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className="space-y-2">
        {pillars.map((pillar) => (
          <li key={pillar.name} className="bg-muted rounded-xl p-3">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selection.pillars.has(pillar.name)}
                onChange={(event) => toggle(pillar.name, event.target.checked)}
                className="mt-1 accent-[color:var(--sg-accent)]"
              />
              <span className="min-w-0">
                <span className="text-foreground block text-[13px] font-semibold">
                  {pillar.name}
                </span>
                <span className="text-muted-foreground block text-[12px] leading-relaxed">
                  {pillar.description}
                </span>
                {pillar.examples.length > 0 && (
                  <span className="text-muted-foreground/80 mt-1 block text-[11px]">
                    e.g. {pillar.examples.join(" · ")}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
