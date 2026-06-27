"use client";

import { useState } from "react";
import { FolderPlus, Layers, Trash2 } from "lucide-react";
import { useInspiration } from "@/components/inspiration/inspiration-context";

export default function PillarSidebar() {
  const {
    pillars,
    items,
    activePillarId,
    setActivePillarId,
    addPillar,
    deletePillar,
  } = useInspiration();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const countFor = (id: string | null) =>
    id === null
      ? items.length
      : items.filter((it) => it.pillarId === id).length;

  const submit = () => {
    const id = addPillar(name);
    if (id) setActivePillarId(id);
    setName("");
    setAdding(false);
  };

  const rowClass = (active: boolean) =>
    `group flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold transition-colors ${
      active
        ? "bg-foreground text-background"
        : "text-foreground/70 hover:bg-muted"
    }`;

  return (
    <aside className="flex w-full shrink-0 flex-col gap-1 lg:w-60">
      <button
        type="button"
        onClick={() => setActivePillarId(null)}
        className={rowClass(activePillarId === null)}
      >
        <span className="inline-flex items-center gap-2">
          <Layers className="h-4 w-4" />
          All inspiration
        </span>
        <span className="text-xs opacity-60">{countFor(null)}</span>
      </button>

      <p className="text-foreground/40 px-3 pt-4 pb-1 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
        Content pillars
      </p>

      {pillars.map((pillar) => (
        <div key={pillar.id} className="group/row relative">
          <button
            type="button"
            onClick={() => setActivePillarId(pillar.id)}
            className={rowClass(activePillarId === pillar.id)}
          >
            <span className="truncate">{pillar.name}</span>
            <span className="text-xs opacity-60">{countFor(pillar.id)}</span>
          </button>
          <button
            type="button"
            onClick={() => deletePillar(pillar.id)}
            className="text-foreground/40 absolute top-1/2 right-2 hidden -translate-y-1/2 rounded p-1 group-hover/row:block hover:text-red-500"
            aria-label={`Delete ${pillar.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {adding ? (
        <input
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              setName("");
              setAdding(false);
            }
          }}
          placeholder="Folder name"
          className="border-border bg-background text-foreground mt-1 rounded-xl border px-3 py-2 text-sm outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-foreground/60 hover:bg-muted mt-1 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold"
        >
          <FolderPlus className="h-4 w-4" />
          New folder
        </button>
      )}
    </aside>
  );
}
