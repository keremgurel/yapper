"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** A growable list of text/URL rows. Always keeps at least one row visible. */
export default function LinkListInput({
  value,
  onChange,
  placeholder,
  addLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  const rows = value.length === 0 ? [""] : value;
  const set = (i: number, v: string) =>
    onChange(rows.map((it, idx) => (idx === i ? v : it)));
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, ""]);

  return (
    <div className="space-y-2">
      {rows.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={v}
            onChange={(e) => set(i, e.target.value)}
            placeholder={placeholder}
          />
          {rows.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(i)}
              className="text-muted-foreground hover:text-destructive shrink-0"
              aria-label="Remove"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={add}
        className="text-muted-foreground hover:text-foreground -ml-2"
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}
