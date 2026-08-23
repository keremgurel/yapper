import type { SurfaceBudget } from "@/lib/brain/context/budgets";
import type { BrainSurface } from "@/lib/db/schema";

/** One line of the index, and where it ended up. */
export interface PreviewEntry {
  ref: string;
  id: string;
  type: "skill" | "context";
  line: string;
  loaded: boolean;
}

/** Exactly what a given surface sends, as the compiler produced it. */
export interface BrainPreview {
  surface: BrainSurface;
  budget: SurfaceBudget;
  core: string;
  index: string;
  loaded: string;
  section: string;
  used: { skills: string[]; context: string[] };
  entries: PreviewEntry[];
}

export async function fetchPreview(
  surface: BrainSurface,
  task = "",
  signal?: AbortSignal,
): Promise<BrainPreview> {
  const params = new URLSearchParams({ surface });
  if (task) params.set("task", task);
  const res = await fetch(`/api/brain/preview?${params}`, { signal });
  if (!res.ok) throw new Error(`preview_api_${res.status}`);
  return (await res.json()) as BrainPreview;
}

/** The surfaces a creator can look at, in the order they meet them. */
export const PREVIEW_SURFACES: { value: BrainSurface; label: string }[] = [
  { value: "script", label: "Writing a script" },
  { value: "hooks", label: "Writing hooks" },
  { value: "ideate", label: "Coming up with ideas" },
  { value: "expand", label: "Working up a reference" },
  { value: "caption", label: "Writing a caption" },
  { value: "chat", label: "Talking to the coach" },
  { value: "capture", label: "Filing a quick idea" },
];
