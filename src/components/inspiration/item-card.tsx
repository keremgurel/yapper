"use client";

import { useState } from "react";
import { ExternalLink, FileText, Trash2 } from "lucide-react";
import PlatformBadge from "@/components/inspiration/platform-badge";
import { useInspiration } from "@/components/inspiration/inspiration-context";
import type { InspirationItem } from "@/lib/inspiration/types";

export default function ItemCard({ item }: { item: InspirationItem }) {
  const { pillars, moveItem, deleteItem } = useInspiration();
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <article className="border-border bg-card flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-md">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-muted relative block aspect-video overflow-hidden"
      >
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="text-foreground/30 flex h-full w-full items-center justify-center text-xs font-bold">
            No preview
          </div>
        )}
        <span className="absolute top-2 left-2">
          <PlatformBadge platform={item.platform} />
        </span>
      </a>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="text-foreground line-clamp-2 text-sm font-bold">
          {item.title}
        </h3>
        {item.author && (
          <p className="text-foreground/55 mt-0.5 truncate text-xs">
            {item.author}
          </p>
        )}

        {item.transcript && (
          <>
            <button
              type="button"
              onClick={() => setShowTranscript((v) => !v)}
              className="text-foreground/70 hover:text-foreground mt-2 inline-flex w-fit items-center gap-1.5 text-xs font-bold"
            >
              <FileText className="h-3.5 w-3.5" />
              {showTranscript ? "Hide transcript" : "Transcript"}
            </button>
            {showTranscript && (
              <p className="text-foreground/60 mt-2 max-h-40 overflow-y-auto text-xs leading-5">
                {item.transcript}
              </p>
            )}
          </>
        )}

        <div className="mt-3 flex items-center gap-2 pt-2">
          <select
            value={item.pillarId ?? ""}
            onChange={(e) => moveItem(item.id, e.target.value || null)}
            className="border-border bg-background text-foreground/80 min-w-0 flex-1 cursor-pointer rounded-lg border px-2 py-1 text-xs"
            aria-label="Move to folder"
          >
            <option value="">Unsorted</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/50 hover:text-foreground rounded-lg p-1.5"
            aria-label="Open original"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={() => deleteItem(item.id)}
            className="text-foreground/50 rounded-lg p-1.5 hover:text-red-500"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
