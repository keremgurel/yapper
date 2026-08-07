"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** One labelled free-text field of the project brain. Render-only: the parent
 * owns the value and the autosave. */
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
    <div className="space-y-2">
      <Label htmlFor={id} className="sg-field-label">
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
