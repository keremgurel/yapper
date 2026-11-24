import {
  getStyleLook,
  updateStyleLook,
  type StyleLookRow,
} from "@/lib/db/style-looks";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import { editTemplate, type TemplateEdit } from "../templates/edit-template";
import { lookAsTemplate, lookName } from "./look-template";

export const MAX_EDITS = 8;

export interface EditedLook {
  look: StyleLookRow;
  /** What the validator clamped or dropped on the way. */
  notes: string[];
}

/**
 * Rename a look, change it, or both. Edits apply in order and all or nothing:
 * if one is refused, the look stays as it was and the refusal says which edit
 * and what would have worked.
 */
export async function editLook(
  userId: string,
  id: string,
  input: { name?: string; edits?: readonly TemplateEdit[] },
): Promise<OperationResult<EditedLook>> {
  const look = await getStyleLook(userId, id);
  if (!look) return refused(404, "not_found");

  let template = lookAsTemplate(look);
  const notes: string[] = [];
  for (const [index, edit] of (input.edits ?? [])
    .slice(0, MAX_EDITS)
    .entries()) {
    const result = editTemplate(template, edit);
    if (!result.ok) {
      return refused(
        400,
        result.reason,
        `Edit ${index + 1}: ${result.message} It could be: ${result.valid.join(", ")}.`,
      );
    }
    template = result.template;
    notes.push(...result.notes);
  }

  const saved = await updateStyleLook(userId, id, {
    name: lookName(input.name, look.name),
    layers: template.layers,
  });
  return saved ? succeeded({ look: saved, notes }) : refused(404, "not_found");
}
