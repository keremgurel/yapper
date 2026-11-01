import type { CanvasState } from "@/lib/content/canvas-actions";
import {
  docFromItem,
  patchFromDoc,
  type CanvasBlock,
} from "@/lib/content/canvas-doc";
import type { VersionFormat } from "@/lib/content/formats";
import { hookTexts, normalizeHooks } from "@/lib/content/normalize";
import { updateOwnContentItem } from "@/lib/content/operations/update-item";
import type { getContentItem } from "@/lib/db/content";
import {
  listContentVersions,
  saveContentVersion,
} from "@/lib/db/content-versions";
import {
  refused,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";

type ContentRow = NonNullable<Awaited<ReturnType<typeof getContentItem>>>;

/** One version of an idea as the canvas shows it. The title is always the
 * idea's own; a version's openers are its hooks. */
export interface CanvasDocument extends CanvasState {
  ideaID: string;
  format: VersionFormat;
  lead: boolean;
  blocks: CanvasBlock[];
}

/**
 * The stored document for one version: the lead lives on the item, any
 * other version in its own row, which is empty until something is written.
 */
export async function readCanvasDocument(
  userId: string,
  item: ContentRow,
  format: VersionFormat,
): Promise<CanvasDocument> {
  if (format === item.leadFormat)
    return {
      ideaID: item.id,
      format,
      lead: true,
      title: item.title,
      blocks: docFromItem(item),
      hooks: hookTexts(item.hooks),
    };
  const version = (await listContentVersions(userId, item.id)).find(
    (row) => row.format === format,
  );
  return {
    ideaID: item.id,
    format,
    lead: false,
    title: item.title,
    blocks: version ? docFromItem(version) : [],
    hooks: version ? hookTexts(version.hooks) : [],
  };
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Write back only what an edit changed, the way the canvas autosave does: a
 * title on the item, the lead's body and hooks on the item, another
 * version's body and hooks (its first opener doubling as its title) on its
 * own row.
 */
export async function saveCanvasDocument(
  userId: string,
  before: CanvasDocument,
  after: CanvasState,
): Promise<OperationResult<null>> {
  const body = patchFromDoc(after.blocks);
  const blocksChanged = !same(patchFromDoc(before.blocks).blocks, body.blocks);
  const hooksChanged = !same(before.hooks, after.hooks);
  const itemPatch: Record<string, unknown> = {};
  if (after.title !== before.title) itemPatch.title = after.title;

  if (before.lead) {
    if (blocksChanged) Object.assign(itemPatch, body);
    if (hooksChanged) itemPatch.hooks = after.hooks;
  } else if (blocksChanged || hooksChanged) {
    const saved = await saveContentVersion(
      userId,
      before.ideaID,
      before.format,
      {
        ...(blocksChanged ? body : {}),
        ...(hooksChanged
          ? {
              hooks: normalizeHooks(after.hooks),
              title: after.hooks[0] ?? null,
            }
          : {}),
      },
    );
    if (!saved) return refused(404, "not_found");
  }

  if (Object.keys(itemPatch).length) {
    const saved = await updateOwnContentItem(userId, before.ideaID, itemPatch);
    if (!saved.ok) return saved;
  }
  return succeeded(null);
}
