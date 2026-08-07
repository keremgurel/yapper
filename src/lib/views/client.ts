import type {
  ContentStage,
  LibraryGrouping,
  LibraryViewKind,
} from "@/lib/db/schema";

export interface LibraryView {
  id: string;
  name: string;
  kind: LibraryViewKind;
  groupBy: LibraryGrouping | null;
  filters: Record<string, string[]>;
  columns: string[];
  sortOrder: number;
}

export type ViewDraft = Omit<LibraryView, "id" | "sortOrder">;

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`views_api_${res.status}`);
  return (await res.json()) as T;
}

export async function listViews(stage: ContentStage): Promise<LibraryView[]> {
  return (
    await json<{ views: LibraryView[] }>(
      await fetch(`/api/views?stage=${stage}`),
    )
  ).views;
}

export async function createView(
  stage: ContentStage,
  draft: ViewDraft,
): Promise<LibraryView> {
  return (
    await json<{ view: LibraryView }>(
      await fetch(`/api/views?stage=${stage}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      }),
    )
  ).view;
}

export async function updateView(
  id: string,
  draft: ViewDraft,
): Promise<LibraryView> {
  return (
    await json<{ view: LibraryView }>(
      await fetch(`/api/views/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      }),
    )
  ).view;
}

export async function deleteView(id: string): Promise<void> {
  await json(await fetch(`/api/views/${id}`, { method: "DELETE" }));
}
