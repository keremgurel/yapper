"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** One labelled free-text field of the project brain. Render-only: the parent
 * owns the value and the autosave. The box grows with what is written. */
export default function ProjectField({
  id,
  label,
  placeholder,
  rows,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  rows: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-foreground text-[13px] font-medium">
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="text-[15px] leading-relaxed"
      />
    </div>
  );
}
