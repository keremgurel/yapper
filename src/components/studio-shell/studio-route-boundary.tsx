import type { ReactNode } from "react";

/**
 * Studio's account-backed surfaces are shared by the browser and desktop app.
 * Only the performance-critical editor is native; its web route renders the
 * desktop handoff inside the same shell instead of hiding all of Studio.
 */
export default function StudioRouteBoundary({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
