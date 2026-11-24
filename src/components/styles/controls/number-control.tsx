"use client";

import { Slider } from "radix-ui";
import type { NumberOption } from "@/lib/style-library/format/option-spec";
import ControlRow from "./control-row";

const shown = (spec: NumberOption, value: number) => {
  const rounded = Number(value.toFixed(2));
  return spec.unit === "px" ? `${rounded} px` : String(rounded);
};

/** A slider across the option's allowed range. The preview follows the drag. */
export default function NumberControl({
  spec,
  value,
  onChange,
}: {
  spec: NumberOption;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <ControlRow label={spec.label} value={shown(spec, value)} help={spec.help}>
      <Slider.Root
        className="relative flex h-5 w-full touch-none items-center select-none"
        min={spec.min}
        max={spec.max}
        step={spec.step ?? 1}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
        aria-label={spec.label}
      >
        <Slider.Track className="bg-muted relative h-1.5 grow rounded-full">
          <Slider.Range className="bg-foreground absolute h-full rounded-full" />
        </Slider.Track>
        <Slider.Thumb className="bg-card block size-4 rounded-full shadow-[var(--sg-shadow-raised)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sg-accent)]" />
      </Slider.Root>
    </ControlRow>
  );
}
