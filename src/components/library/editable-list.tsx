"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function EditableList({
  label,
  items,
  onChange,
  addLabel = "Add",
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel?: string;
  placeholder?: string;
}) {
  const update = (i: number, value: string) => {
    onChange(items.map((it, idx) => (idx === i ? value : it)));
  };
  const remove = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
  };
  const add = () => onChange([...items, ""]);

  return (
    <div>
      <p className="sg-field-label mb-2">{label}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="bg-muted text-muted-foreground mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black">
              {i + 1}
            </span>
            <Textarea
              value={item}
              rows={1}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              className="min-h-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(i)}
              className="text-muted-foreground hover:text-destructive mt-1"
              aria-label="Remove"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={add}
        className="text-muted-foreground hover:text-foreground mt-2 -ml-2"
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}
