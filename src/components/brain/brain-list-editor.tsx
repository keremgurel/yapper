"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * The lines inside a collected block: hooks that worked, formats, rules.
 *
 * One line at a time, added with Enter, because that is how someone empties
 * their head into a list. Editing a line in place rather than opening a form
 * keeps the block readable while it is being written.
 */
export default function BrainListEditor({
  items,
  placeholder,
  onChange,
}: {
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, text]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li
              key={`${index}-${item}`}
              className="group flex items-center gap-2"
            >
              <span className="text-muted-foreground text-xs">•</span>
              <Input
                value={item}
                aria-label={`Line ${index + 1}`}
                onChange={(event) =>
                  onChange(
                    items.map((value, i) =>
                      i === index ? event.target.value : value,
                    ),
                  )
                }
                onBlur={(event) => {
                  // An emptied line means "delete it", which is what pressing
                  // backspace through one looks like it should do.
                  if (!event.target.value.trim()) {
                    onChange(items.filter((_, i) => i !== index));
                  }
                }}
                className="h-8 flex-1 text-sm"
              />
              <button
                type="button"
                aria-label={`Remove line ${index + 1}`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="text-muted-foreground hover:text-foreground opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Plus className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        <Input
          value={draft}
          placeholder={placeholder}
          aria-label="Add a line"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={add}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            add();
          }}
          className="h-8 flex-1 text-sm"
        />
      </div>
    </div>
  );
}
