"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Section } from "@/components/studio-ui";
import { loadItems } from "@/lib/inspiration/store";
import type { InspirationItem } from "@/lib/inspiration/types";

/**
 * Content the creator likes, read from the swipe file they already keep.
 *
 * Part of the brain because it is part of the answer: what someone saves says
 * as much about what they are trying to make as anything they could write in a
 * field. Read-only here, deliberately. Saving and sorting stays on the
 * Inspiration page, so there is one place a swipe file is kept rather than two
 * that drift.
 */
export default function InspirationCard() {
  const [items, setItems] = useState<InspirationItem[] | null>(null);

  useEffect(() => {
    // localStorage, so this can only run once the page is in a browser, and a
    // frame later so the read is not a synchronous setState during mount.
    const read = window.requestAnimationFrame(() => setItems(loadItems()));
    return () => window.cancelAnimationFrame(read);
  }, []);

  const saved = (items ?? [])
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);

  return (
    <Section
      title="Content I like"
      action={
        <Link
          href="/studio/inspiration"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs no-underline"
        >
          Open swipe file <ArrowUpRight className="h-3 w-3" />
        </Link>
      }
    >
      {items === null ? null : saved.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing saved yet. Paste a link you wish you had made on the
          Inspiration page and it shows up here.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {saved.map((item) => (
            <li key={item.id} className="min-w-0">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/90 hover:text-foreground block truncate text-sm no-underline"
                title={item.title}
              >
                {item.title || item.url}
                {item.author ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {item.author}
                  </span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
