import {
  countStyleLooks,
  createStyleLook,
  getStyleLook,
  listStyleLooks,
  type StyleLookRow,
} from "@/lib/db/style-looks";
import { ensureUser } from "@/lib/db/users";
import { UUID } from "@/lib/chirpy/protocol";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import { getTemplate, TEMPLATES } from "../templates/registry";
import { lookName, MAX_LOOKS, withoutContent } from "./look-template";

/**
 * Save a new look for the creator, started from a library template or copied
 * from one of their own. Nothing of the source changes.
 */
export async function saveLook(
  userId: string,
  input: { from: string; name?: string },
): Promise<OperationResult<StyleLookRow>> {
  await ensureUser(userId);
  if ((await countStyleLooks(userId)) >= MAX_LOOKS)
    return refused(409, "too_many_looks");

  const template = getTemplate(input.from);
  if (template) {
    return succeeded(
      await createStyleLook(userId, {
        name: lookName(input.name, template.name),
        baseTemplateId: template.id,
        layers: withoutContent(template.layers),
      }),
    );
  }

  const own = UUID.test(input.from)
    ? await getStyleLook(userId, input.from)
    : null;
  if (!own) {
    const looks = await listStyleLooks(userId);
    return refused(
      404,
      "not_found",
      [...TEMPLATES.map((t) => t.id), ...looks.map((look) => look.id)].join(
        ", ",
      ),
    );
  }
  return succeeded(
    await createStyleLook(userId, {
      name: lookName(input.name, `${own.name} copy`),
      baseTemplateId: own.baseTemplateId,
      layers: own.layers,
    }),
  );
}
