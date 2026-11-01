import type {
  IdeaViewCreateInput,
  IdeaViewDeleteInput,
  IdeaViewUpdateInput,
} from "../../../../../protocol/app-actions.generated";
import { deleteView, listViews } from "@/lib/db/library-views";
import { createOwnView } from "@/lib/views/operations/create-view";
import { updateOwnView } from "@/lib/views/operations/update-view";
import {
  failureFrom,
  StudioActionFailure,
  type StudioActionDefinition,
} from "../executor";

/** The Ideas tab shows the library stage's views. */
const STAGE = "library";

function filters(
  statuses: string[] | undefined,
  pillarIDs: string[] | undefined,
  current: Record<string, string[]> = {},
): Record<string, string[]> {
  const next = { ...current };
  if (statuses) next.status = statuses;
  if (pillarIDs) next.pillarId = pillarIDs;
  return next;
}

export const createViewAction: StudioActionDefinition<IdeaViewCreateInput> = {
  async run({ name, kind, groupBy, statuses, pillarIDs }, { userId }) {
    const created = await createOwnView(userId, STAGE, {
      name,
      kind: kind ?? "table",
      groupBy: groupBy ?? null,
      filters: filters(statuses, pillarIDs),
    });
    if (!created.ok) throw failureFrom(created, "that view");
    return {
      summary: `Saved a view called “${created.value.name}”.`,
      effects: ["ideaViews"],
    };
  },
};

export const updateViewAction: StudioActionDefinition<IdeaViewUpdateInput> = {
  async run(input, { userId }) {
    const current = (await listViews(userId, STAGE)).find(
      (view) => view.id === input.viewID,
    );
    if (!current)
      throw new StudioActionFailure(
        "not_found",
        "I couldn’t find that view. It may have been deleted.",
      );
    // A view is saved whole, so unchanged fields are sent back as they are,
    // columns included.
    const updated = await updateOwnView(userId, current.id, {
      name: input.name ?? current.name,
      kind: input.kind ?? current.kind,
      groupBy: input.ungroup ? null : (input.groupBy ?? current.groupBy),
      filters: filters(input.statuses, input.pillarIDs, current.filters),
      columns: current.columns,
    });
    if (!updated.ok) throw failureFrom(updated, "that view");
    return {
      summary: `Updated the “${updated.value.name}” view.`,
      effects: ["ideaViews"],
    };
  },
};

export const deleteViewAction: StudioActionDefinition<IdeaViewDeleteInput> = {
  async run({ viewID }, { userId }) {
    const current = (await listViews(userId, STAGE)).find(
      (view) => view.id === viewID,
    );
    if (!current || !(await deleteView(userId, viewID)))
      throw new StudioActionFailure(
        "not_found",
        "That view was already gone, so nothing was deleted.",
      );
    return {
      summary: `Deleted the “${current.name}” view.`,
      effects: ["ideaViews"],
    };
  },
  describe({ viewID }, names) {
    const name = names.views[viewID];
    return name ? `Delete the “${name}” view` : "Delete that view";
  },
};
