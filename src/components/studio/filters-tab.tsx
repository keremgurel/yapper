"use client";

import { Check } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { VISUAL_FILTERS } from "@/lib/studio/visual-filter";

export default function FiltersTab() {
  const { visualFilter, setVisualFilter } = useStudio();

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-4">
        <p className="text-foreground text-xs font-black">Video filters</p>
        <p className="text-foreground/40 mt-0.5 text-[10px]">
          Applied to the preview and final export
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {VISUAL_FILTERS.map((filter, index) => {
          const active = visualFilter.id === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() =>
                setVisualFilter({ ...visualFilter, id: filter.id })
              }
              className={`relative overflow-hidden rounded-xl border p-2 text-left ${active ? "border-[color:var(--sg-accent)]" : "border-border hover:border-foreground/25"}`}
            >
              <span
                className="mb-2 block h-14 rounded-lg"
                style={{
                  background: [
                    "linear-gradient(135deg,#d7a77d,#5f817b)",
                    "linear-gradient(135deg,#f0d2ac,#6f9fa3)",
                    "linear-gradient(135deg,#e8b083,#7b675c)",
                    "linear-gradient(135deg,#8eb0cd,#4c6677)",
                    "linear-gradient(135deg,#f48b55,#235f65)",
                    "linear-gradient(135deg,#d5d5d5,#343434)",
                    "linear-gradient(135deg,#d8c5ae,#7f8b87)",
                  ][index],
                }}
              />
              <span className="text-foreground block text-[10px] font-black">
                {filter.name}
              </span>
              <span className="text-foreground/35 block text-[9px]">
                {filter.hint}
              </span>
              {active && (
                <span className="absolute top-3 right-3 grid h-5 w-5 place-items-center rounded-full bg-[color:var(--sg-accent)] text-white">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {visualFilter.id !== "original" && (
        <label className="mt-5 block space-y-2">
          <span className="flex items-center justify-between">
            <span className="text-foreground/55 text-[10px] font-black uppercase">
              Strength
            </span>
            <span className="text-foreground/45 text-[10px] tabular-nums">
              {Math.round(visualFilter.strength * 100)}%
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(visualFilter.strength * 100)}
            onChange={(event) =>
              setVisualFilter({
                ...visualFilter,
                strength: Number(event.target.value) / 100,
              })
            }
            className="w-full accent-[color:var(--sg-accent)]"
          />
        </label>
      )}
    </div>
  );
}
