"use client";

import type { ReactNode } from "react";

/**
 * How every part of the canvas is named: a real title in sentence case, a
 * quiet note beside it, and the part's controls on the same line. One
 * treatment for hooks, the script, key points, and anything the creator adds.
 */
export default function CanvasSectionTitle({
  title,
  meta,
  actions,
  className = "",
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-2 flex min-h-7 items-center gap-3 ${className}`}>
      <h2 className="text-foreground min-w-0 flex-1 text-[15px] font-semibold tracking-[-0.01em]">
        {title}
        {meta ? (
          <span className="text-muted-foreground ml-2 text-[13px] font-normal tracking-normal">
            {meta}
          </span>
        ) : null}
      </h2>
      {actions ? (
        <div className="flex shrink-0 items-center gap-0.5">{actions}</div>
      ) : null}
    </div>
  );
}
