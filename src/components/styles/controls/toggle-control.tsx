"use client";

import { Switch } from "radix-ui";
import type { BooleanOption } from "@/lib/style-library/format/option-spec";

/** On or off, with the label as the thing you click. */
export default function ToggleControl({
  spec,
  value,
  onChange,
}: {
  spec: BooleanOption;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="py-3">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-foreground text-[13px] font-medium">
          {spec.label}
        </span>
        <Switch.Root
          checked={value}
          onCheckedChange={onChange}
          className="bg-muted data-[state=checked]:bg-foreground relative h-6 w-10 shrink-0 rounded-full transition-colors duration-[var(--sg-dur-fast)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--sg-accent)]"
        >
          <Switch.Thumb className="bg-card block size-5 translate-x-0.5 rounded-full shadow-[var(--sg-shadow-raised)] transition-transform duration-[var(--sg-dur-fast)] data-[state=checked]:translate-x-[18px]" />
        </Switch.Root>
      </label>
      {spec.help && (
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          {spec.help}
        </p>
      )}
    </div>
  );
}
