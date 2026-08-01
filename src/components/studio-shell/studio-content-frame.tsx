import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

/**
 * The single horizontal frame used by every Studio surface. Keeping this in
 * the shared shell prevents route-specific widths from moving the workspace
 * when users navigate between dashboard pages and the editor.
 */
export default function StudioContentFrame({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[var(--studio-content-max-width)]",
        className,
      )}
      {...props}
    />
  );
}
