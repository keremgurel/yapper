"use client";

import { LayoutGrid, Rows3, type LucideIcon } from "lucide-react";

export type BankView = "table" | "cards";

function Segment({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
        active
          ? "bg-card text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/**
 * Table/cards switch for the bank. Labeled segments rather than two bare
 * icons: the card view exists for reading a captured idea, and a mode you
 * cannot name is a mode nobody switches to.
 */
export default function IdeaViewToggle({
  view,
  onChange,
}: {
  view: BankView;
  onChange: (view: BankView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Bank view"
      className="bg-muted flex shrink-0 items-center gap-0.5 rounded-lg p-0.5"
    >
      <Segment
        active={view === "table"}
        icon={Rows3}
        label="Table"
        onClick={() => onChange("table")}
      />
      <Segment
        active={view === "cards"}
        icon={LayoutGrid}
        label="Cards"
        onClick={() => onChange("cards")}
      />
    </div>
  );
}
