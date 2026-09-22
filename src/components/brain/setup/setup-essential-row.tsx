"use client";

import { Textarea } from "@/components/ui/textarea";

/**
 * One Essentials field in the review: what is there now, what the document
 * says, and whether to take it. The proposed text is editable so the creator
 * fixes wording here rather than after it lands.
 */
export default function SetupEssentialRow({
  label,
  current,
  proposed,
  selected,
  onSelect,
  onEdit,
}: {
  label: string;
  current: string;
  proposed: string;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onEdit: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(event.target.checked)}
          className="accent-[color:var(--sg-accent)]"
        />
        <span className="sg-field-label">{label}</span>
      </label>
      {current ? (
        <p className="text-muted-foreground line-clamp-3 text-[12px] leading-relaxed">
          Now: {current}
        </p>
      ) : (
        <p className="text-muted-foreground text-[12px]">Now: empty</p>
      )}
      <Textarea
        value={proposed}
        onChange={(event) => onEdit(event.target.value)}
        rows={3}
        disabled={!selected}
        className="text-[13px] leading-relaxed"
      />
    </div>
  );
}
