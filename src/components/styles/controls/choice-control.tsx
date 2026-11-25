"use client";

import { Button } from "@/components/ui/button";
import type { EnumOption } from "@/lib/style-library/format/option-spec";
import ControlRow from "./control-row";

/** Every choice shown at once, so switching is one click and the alternatives are visible. */
export default function ChoiceControl({
  spec,
  value,
  onChange,
}: {
  spec: EnumOption;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ControlRow label={spec.label} help={spec.help}>
      <div
        role="radiogroup"
        aria-label={spec.label}
        className="flex flex-wrap gap-1.5"
      >
        {spec.choices.map((choice) => (
          <Button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={choice.value === value}
            size="xs"
            variant={choice.value === value ? "contrast" : "secondary"}
            onClick={() => onChange(choice.value)}
          >
            {choice.label}
          </Button>
        ))}
      </div>
    </ControlRow>
  );
}
