"use client";

import { usePillars } from "@/hooks/use-pillars";

/**
 * Files one item under one of the creator's project pillars.
 *
 * Selects by pillar id, not by name, which is what makes this agree with the
 * bulk reclassify bar. A legacy row carries only free text and no link; that
 * text is shown as the current value so it is never silently dropped, and
 * choosing a real pillar replaces it with the link.
 */
export default function ItemPillarField({
  pillarId,
  legacyName,
  onChange,
}: {
  pillarId: string | null;
  legacyName: string | null;
  onChange: (pillarId: string | null) => void;
}) {
  const { pillars } = usePillars();
  const linked = pillars.some((p) => p.id === pillarId);

  return (
    <select
      value={linked && pillarId ? pillarId : ""}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label="Content pillar"
      // A chip you can open: reads as a fact about the piece, and the hover
      // state says it can change.
      className="bg-muted text-foreground hover:bg-muted/70 h-7 max-w-[200px] cursor-pointer truncate rounded-full pr-2 pl-3 text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]"
    >
      <option value="">
        {legacyName && !linked ? legacyName : "No pillar"}
      </option>
      {pillars.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
