import type {
  BrainKnowledgeAddInput,
  BrainKnowledgeUpdateInput,
} from "../../../../../protocol/app-actions.generated";
import { parseBrainBlockInput } from "@/lib/brain/input";
import {
  createKnowledge,
  reorderKnowledge,
  updateKnowledge,
} from "@/lib/brain/operations/knowledge";
import { listBrainBlocks, type BrainBlockRow } from "@/lib/db/project-brain";
import { getActiveProject } from "@/lib/db/projects";
import {
  StudioActionFailure,
  type ActionOutcome,
  type StudioActionDefinition,
} from "../executor";
import { brainFailure } from "./failure";
import { movedTo, quoted } from "./labels";

/** A section written from the conversation, through the same create as the
 * Brain page's Add > Write. */
export const knowledgeAddAction: StudioActionDefinition<BrainKnowledgeAddInput> =
  {
    async run(input, { userId }) {
      const items = (input.items ?? [])
        .map((item) => item.trim())
        .filter(Boolean);
      const block = parseBrainBlockInput({
        title: input.title,
        kind: items.length ? "list" : "note",
        body: input.body ?? "",
        items,
        digest: input.digest ?? "",
        usage: input.usage ?? "auto",
        tags: ["chirpy"],
        sourceLabel: "Conversation with Chirpy",
      });
      if (!block.title)
        throw new StudioActionFailure("no_title", "A section needs a title.");
      const saved = await createKnowledge(userId, {
        ...block,
        title: block.title,
      });
      if (!saved.ok) throw brainFailure(saved, "that section");
      return {
        summary: `Added ${quoted(saved.value.title)} to your Knowledge.`,
        effects: ["brain"],
      };
    },
  };

/** One passage swapped for another, only when it appears exactly once. */
function swapped(
  text: string,
  find: string,
  replaceWith: string,
  title: string,
) {
  const at = text.indexOf(find);
  if (at < 0) return null;
  if (text.indexOf(find, at + find.length) >= 0)
    throw new StudioActionFailure(
      "ambiguous_passage",
      `That passage appears more than once in ${quoted(title)}. Quote a longer piece of it.`,
    );
  return text.slice(0, at) + replaceWith + text.slice(at + find.length);
}

/** The edit as the block editor would save it, from the stored section. */
export function knowledgePatch(
  block: BrainBlockRow,
  input: BrainKnowledgeUpdateInput,
) {
  const patch: Record<string, unknown> = {};
  if (input.title?.trim()) patch.title = input.title.trim();
  if (input.digest !== undefined) patch.digest = input.digest;
  if (input.usage) patch.usage = input.usage;

  if (input.body !== undefined) {
    if (!input.append && (block.kind === "doc" || block.kind === "table"))
      throw new StudioActionFailure(
        "whole_rewrite",
        `${quoted(block.title)} is imported, so I won’t rewrite it whole. I can add to it or swap one passage, or you can edit it on the Brain tab.`,
      );
    patch.body =
      input.append && block.body.trim()
        ? `${block.body.trimEnd()}\n\n${input.body.trim()}`
        : input.body;
  }
  if (input.items) {
    const items = input.items.map((item) => item.trim()).filter(Boolean);
    patch.items = input.append ? [...block.items, ...items] : items;
  }
  if (input.find !== undefined) {
    const replaceWith = input.replaceWith ?? "";
    const body = swapped(block.body, input.find, replaceWith, block.title);
    if (body !== null) patch.body = body;
    else {
      const index = block.items.findIndex((item) => item.includes(input.find!));
      if (index < 0)
        throw new StudioActionFailure(
          "passage_not_found",
          `I couldn’t find that passage in ${quoted(block.title)}, so nothing changed.`,
        );
      const items = [...block.items];
      items[index] = swapped(
        items[index],
        input.find,
        replaceWith,
        block.title,
      )!;
      patch.items = items;
    }
  }
  return parseBrainBlockInput(patch);
}

/** The block editor's save and the list's reorder, for one section. */
export const knowledgeUpdateAction: StudioActionDefinition<BrainKnowledgeUpdateInput> =
  {
    async run(input, { userId }): Promise<ActionOutcome> {
      const project = await getActiveProject(userId);
      const blocks = await listBrainBlocks(project.id);
      const block = blocks.find((item) => item.id === input.blockID);
      if (!block)
        throw new StudioActionFailure(
          "not_found",
          "I couldn’t find that section. It may have been deleted.",
        );
      const patch = knowledgePatch(block, input);
      const moving = input.position !== undefined;
      if (!Object.keys(patch).length && !moving)
        throw new StudioActionFailure(
          "no_fields",
          `Tell me what to change in ${quoted(block.title)}.`,
        );

      let title = block.title;
      const done: string[] = [];
      if (Object.keys(patch).length) {
        const saved = await updateKnowledge(userId, block.id, patch);
        if (!saved.ok) throw brainFailure(saved, quoted(block.title));
        title = saved.value.title;
        done.push(`Updated ${quoted(title)} in your Knowledge.`);
      }
      if (moving) {
        const order = movedTo(
          blocks.map((item) => item.id),
          block.id,
          input.position!,
        );
        const moved = await reorderKnowledge(userId, order);
        if (!moved.ok) throw brainFailure(moved, quoted(title));
        done.push(
          `Moved ${quoted(title)} to position ${order.indexOf(block.id) + 1}.`,
        );
      }
      return { summary: done.join(" "), effects: ["brain"] };
    },
  };
