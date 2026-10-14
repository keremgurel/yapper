import { ESSENTIAL_FIELD_CAPS } from "@/lib/brain/context/field-caps";
import { charactersCut } from "@/lib/brain/field-fit";
import { PROJECT_FIELDS, type Project } from "@/lib/project/client";
import { FIT_CAUTION } from "./field-fit";

/** One line under the card's title: whether every field fits, or how many
 * are cut short. Says nothing while they all fit. */
export default function EssentialsFitNote({ project }: { project: Project }) {
  const over = PROJECT_FIELDS.filter(
    (field) =>
      charactersCut(project[field.key], ESSENTIAL_FIELD_CAPS[field.key]) > 0,
  );
  if (over.length === 0) return null;
  return (
    <p className={`mt-2 text-xs ${FIT_CAUTION}`}>
      {over.length === 1
        ? `“${over[0].label}” is longer than the AI reads. Keep it to a sentence or two and move the detail to Knowledge.`
        : `${over.length} fields are longer than the AI reads. Keep each to a sentence or two and move the detail to Knowledge.`}
    </p>
  );
}
