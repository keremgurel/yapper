/**
 * How the editor arranges itself. The panes are the same either way; only where
 * they sit changes, so nothing about a project depends on this.
 */
export type LayoutId = "classic" | "cinema";

export interface LayoutPreset {
  id: LayoutId;
  label: string;
  hint: string;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  { id: "classic", label: "Classic", hint: "Preview above the timeline" },
  { id: "cinema", label: "Cinema", hint: "Tall preview beside the panels" },
];

export const DEFAULT_LAYOUT: LayoutId = "classic";

export function isLayoutId(v: unknown): v is LayoutId {
  return v === "classic" || v === "cinema";
}
