"use client";

import { Plus, X } from "lucide-react";

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
      <p className="text-foreground/45 mb-2 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
        {label}
      </p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="bg-muted text-foreground/45 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black">
              {i + 1}
            </span>
            <textarea
              value={item}
              rows={1}
              onChange={(e) => update(i, e.target.value)}
              placeholder={placeholder}
              className="border-border bg-background text-foreground focus:border-foreground/40 min-h-9 w-full resize-y rounded-lg border px-3 py-1.5 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-foreground/40 mt-1 shrink-0 rounded p-1 hover:text-red-500"
              aria-label="Remove"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="text-foreground/60 hover:text-foreground mt-2 inline-flex items-center gap-1.5 text-xs font-bold"
      >
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </button>
    </div>
  );
}
