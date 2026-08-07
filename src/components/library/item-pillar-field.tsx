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
      // Borderless and right-aligned: in the rail this is a value you read,
      // not a form field to fill in. The chevron and hover state still say it
      // is editable.
      className="text-foreground hover:bg-muted -mr-1 max-w-[160px] cursor-pointer truncate rounded bg-transparent px-1 py-0.5 text-right text-[13px] font-bold transition-colors outline-none"
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
