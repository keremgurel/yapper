"use client";

import { Input } from "@/components/ui/input";
import type { ColorOption } from "@/lib/style-library/format/option-spec";
import ControlRow from "./control-row";

const HEX = /^#[0-9a-f]{6}$/i;

/** A swatch that opens the system picker, with the hex beside it for typing or pasting. */
export default function ColorControl({
  spec,
  value,
  onChange,
}: {
  spec: ColorOption;
  value: string;
  onChange: (value: string) => void;
}) {
  const commit = (input: HTMLInputElement) => {
    if (HEX.test(input.value)) onChange(input.value.toUpperCase());
    else input.value = value;
  };
  return (
    <ControlRow label={spec.label} help={spec.help}>
      <div className="flex items-center gap-2">
        <label
          className="relative size-10 shrink-0 overflow-hidden rounded-lg shadow-[var(--sg-shadow-raised)]"
          style={{ background: value }}
        >
          <span className="sr-only">Pick {spec.label.toLowerCase()}</span>
          <input
            type="color"
            value={HEX.test(value) ? value : "#000000"}
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        {/* Keyed by the saved value, so the field follows the picker and other edits. */}
        <Input
          key={value}
          defaultValue={value}
          onBlur={(event) => commit(event.currentTarget)}
          onKeyDown={(event) =>
            event.key === "Enter" && commit(event.currentTarget)
          }
          spellCheck={false}
          autoComplete="off"
          aria-label={`${spec.label} hex`}
          className="font-mono text-sm"
        />
      </div>
    </ControlRow>
  );
}
