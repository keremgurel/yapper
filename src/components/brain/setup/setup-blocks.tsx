"use client";

import type { SetupBlock } from "@/lib/brain/setup";
import type { SetupSelection } from "@/lib/brain/setup-client";

/** The sections of the document worth keeping as Knowledge, each optional. */
export default function SetupBlocks({
  blocks,
  selection,
  onChange,
}: {
  blocks: SetupBlock[];
  selection: SetupSelection;
  onChange: (next: SetupSelection) => void;
}) {
  if (!blocks.length) return null;
  const toggle = (title: string, on: boolean) => {
    const next = new Set(selection.blocks);
    if (on) next.add(title);
    else next.delete(title);
    onChange({ ...selection, blocks: next });
  };
  return (
    <section className="space-y-3">
      <h3 className="sg-field-label">Knowledge to add</h3>
      <ul className="space-y-2">
        {blocks.map((block) => (
          <li key={block.title}>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selection.blocks.has(block.title)}
                onChange={(event) => toggle(block.title, event.target.checked)}
                className="mt-1 accent-[color:var(--sg-accent)]"
              />
              <span className="min-w-0">
                <span className="text-foreground block text-[13px] font-medium">
                  {block.title}
                  {block.usage === "core" && (
                    <span className="text-muted-foreground ml-2 text-[11px] font-normal">
                      read on every call
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground block text-[12px]">
                  {block.digest}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
