"use client";

export type BrainView = "essentials" | "knowledge" | "skills";

export type BrainTab = { value: BrainView; label: string; count?: number };

/** The Brain's three tabs. Accent underline on the active one, a quiet count
 * on the tabs that hold a list. */
export default function BrainTabs({
  tabs,
  view,
  onChange,
}: {
  tabs: BrainTab[];
  view: BrainView;
  onChange: (view: BrainView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Brain sections"
      className="border-border mb-6 flex overflow-x-auto border-b"
    >
      {tabs.map((tab) => {
        const active = view === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`relative px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
              active
                ? "text-foreground after:absolute after:inset-x-3 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-[color:var(--sg-accent)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="bg-muted text-muted-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums">
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
