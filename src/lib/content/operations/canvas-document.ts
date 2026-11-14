import type { CanvasState } from "@/lib/content/canvas-actions";
import {
  docFromItem,
  patchFromDoc,
  type CanvasBlock,
} from "@/lib/content/canvas-doc";
import type { VersionFormat } from "@/lib/content/formats";
import {
  hookTexts,
  normalizeBlocks,
  normalizeBody,
  normalizeHooks,
  type LegacyBody,
} from "@/lib/content/normalize";
import { updateOwnContentItem } from "@/lib/content/operations/update-item";
import type { getContentItem } from "@/lib/db/content";
import { ContentConflict } from "@/lib/db/content-conflict";
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
 * A stored row's blocks as the canvas shows them. An idea last saved before
 * the flexible body keeps its key points, example and call to action in
 * their old columns; GET /api/content/[id] folds them into blocks for the
 * client, so the server's copy of the document has to as well, or the writer
 * would miss them and its block numbers would not match the canvas.
 */
function shownBlocks(
  row: LegacyBody & { script: string | null },
): CanvasBlock[] {
  return docFromItem({ blocks: normalizeBody(row).blocks, script: row.script });
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
      blocks: shownBlocks(item),
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

/** Blocks as they are stored, for comparing two copies of a document. */
const storedBlocks = (blocks: CanvasBlock[]) =>
  normalizeBlocks(patchFromDoc(blocks).blocks);

/** Throws ContentConflict when the stored version is no longer the one the
 * edit was made on. */
function unchangedSince(
  before: CanvasDocument,
  current: LegacyBody & { script: string | null },
): void {
  if (
    !same(storedBlocks(shownBlocks(current)), storedBlocks(before.blocks)) ||
    !same(hookTexts(current.hooks), before.hooks)
  )
    throw new ContentConflict();
}

/** The document as saved, in the shape a client sends back as its `base`. */
export function savedDocument(document: CanvasDocument, after: CanvasState) {
  const body = patchFromDoc(after.blocks);
  return {
    format: document.format,
    title: after.title,
    hooks: after.hooks,
    blocks: body.blocks,
    script: body.script,
  };
}

/**
 * Write back only what an edit changed, the way the canvas autosave does: a
 * title on the item, the lead's body and hooks on the item, another
 * version's body and hooks (its first opener doubling as its title) on its
 * own row. Each write first checks, in its own transaction, that the row is
 * still the one `before` was read from, and writes nothing when it is not:
 * an edit the creator saved while Chirpy was writing is never replaced.
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
  }

  try {
    if (Object.keys(itemPatch).length) {
      const saved = await updateOwnContentItem(
        userId,
        before.ideaID,
        itemPatch,
        (current, input) => {
          if (current.title !== before.title) throw new ContentConflict();
          if (before.lead) unchangedSince(before, current);
          return input;
        },
      );
      if (!saved.ok)
        return saved.status === 409
          ? refused(409, "changed_while_working")
          : saved;
    }
    if (!before.lead && (blocksChanged || hooksChanged)) {
      const version = {
        ...(blocksChanged ? body : {}),
        ...(hooksChanged
          ? {
              hooks: normalizeHooks(after.hooks),
              title: after.hooks[0] ?? null,
            }
          : {}),
      };
      const saved = await saveContentVersion(
        userId,
        before.ideaID,
        before.format,
        version,
        (current) => {
          unchangedSince(
            before,
            current ?? { blocks: [], script: null, hooks: [] },
          );
          return version;
        },
      );
      if (!saved) return refused(404, "not_found");
    }
  } catch (error) {
    if (error instanceof ContentConflict)
      return refused(409, "changed_while_working");
    throw error;
  }
  return succeeded(null);
}
