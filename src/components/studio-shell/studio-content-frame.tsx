import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

/**
 * The single horizontal frame used by every Studio surface. Keeping this in
 * the shared shell prevents route-specific widths from moving the workspace
 * when users navigate between dashboard pages and the editor.
 */
export default function StudioContentFrame({
  className,
  fluid = false,
  ...props
}: ComponentPropsWithoutRef<"div"> & { fluid?: boolean }) {
  return (
    <div
      className={cn(
        "w-full",
        fluid
          ? "max-w-none"
          : "mx-auto max-w-[var(--studio-content-max-width)]",
        className,
      )}
      {...props}
    />
  );
}
