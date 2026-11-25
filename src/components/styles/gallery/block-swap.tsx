"use client";

import { Button } from "@/components/ui/button";
import { getStyle } from "@/lib/style-library/registry";
import ControlRow from "../controls/control-row";

/** Which block sits in this place: every style that fits, and "Empty". */
export default function BlockSwap({
  current,
  canHold,
  onPick,
  onClear,
}: {
  current: string | null;
  canHold: string[];
  onPick: (styleId: string) => void;
  onClear: () => void;
}) {
  return (
    <ControlRow label="Block">
      <div
        role="radiogroup"
        aria-label="Block"
        className="flex flex-wrap gap-1.5"
      >
        {canHold.map((id) => (
          <Button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === current}
            size="xs"
            variant={id === current ? "contrast" : "secondary"}
            onClick={() => onPick(id)}
          >
            {getStyle(id)?.name ?? id}
          </Button>
        ))}
        <Button
          type="button"
          role="radio"
          aria-checked={current === null}
          size="xs"
          variant={current === null ? "contrast" : "secondary"}
          onClick={onClear}
        >
          Empty
        </Button>
      </div>
    </ControlRow>
  );
}
