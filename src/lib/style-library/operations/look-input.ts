import contract from "../../../../protocol/app-actions.schema.json";
import type {
  StyleLookEditInput,
  StyleLookSaveInput,
} from "../../../../protocol/app-actions.generated";
import { validate } from "@/lib/chirpy/protocol";

type Schema = Parameters<typeof validate>[1];
const definitions = contract.$defs as Record<string, Schema>;

/**
 * A route body checked against the same contract a Chirpy plan and a
 * connector call are checked against, so the three cannot drift apart.
 */
export const parseLookSave = (body: unknown): StyleLookSaveInput | null =>
  validate(body, definitions.StyleLookSaveInput)
    ? (body as StyleLookSaveInput)
    : null;

export const parseLookEdit = (
  lookID: string,
  body: unknown,
): StyleLookEditInput | null => {
  const input = { ...(body && typeof body === "object" ? body : {}), lookID };
  return validate(input, definitions.StyleLookEditInput)
    ? (input as StyleLookEditInput)
    : null;
};
