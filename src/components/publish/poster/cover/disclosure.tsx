"use client";

import { ChevronDown } from "lucide-react";

/** A folded step. The summary says what is inside and, when set, what state
 * it is in, so a collapsed step is never silently in effect. */
export default function Disclosure({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="group border-border rounded-xl border"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          {meta ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              {meta}
            </span>
          ) : null}
        </span>
        <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-border/60 border-t p-4">{children}</div>
    </details>
  );
}
