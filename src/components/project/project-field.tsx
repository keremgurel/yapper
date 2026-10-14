"use client";

import FieldFit from "@/components/brain/essentials/field-fit";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** One labelled free-text field of the project brain. Render-only: the parent
 * owns the value and the autosave. The box grows with what is written. With
 * a `limit`, it says how much of the field the AI reads. */
export default function ProjectField({
  id,
  label,
  placeholder,
  rows,
  value,
  onChange,
  limit,
}: {
  id: string;
  label: string;
  placeholder: string;
  rows: number;
  value: string;
  onChange: (value: string) => void;
  limit?: number;
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
      {limit ? <FieldFit text={value} limit={limit} /> : null}
    </div>
  );
}
