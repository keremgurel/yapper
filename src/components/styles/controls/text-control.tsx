"use client";

import { Input } from "@/components/ui/input";
import ControlRow from "./control-row";

/** Text or a link. The preview updates as you type; an emptied link clears the picture. */
export default function TextControl({
  label,
  help,
  value,
  maxLength,
  placeholder,
  onChange,
}: {
  label: string;
  help?: string;
  value: string;
  maxLength?: number;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <ControlRow label={label} help={help}>
      <Input
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="text-sm"
      />
    </ControlRow>
  );
}
