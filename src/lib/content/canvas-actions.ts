import type { ContentBlock } from "@/lib/db/schema";
import {
  blockFrom,
  insertBlockAfter,
  type CanvasBlock,
  type CanvasKind,
} from "@/lib/content/canvas-doc";

/**
 * What Chirpy hands back when asked to write on the canvas.
 *
 * The model never edits the document directly. It returns a short list of
 * actions against numbered blocks, and the client applies them, so a reply
 * can only ever add, replace or rewrite whole blocks, never scribble across
 * the creator's other words. The same parser runs on the server before the
 * reply is delivered and on the client before it is applied.
 */
export interface CanvasBlockInput {
  label: string;
  kind: CanvasKind;
  text?: string;
  items?: string[];
}

export type CanvasAction =
  | { type: "replace"; index: number; block: CanvasBlockInput }
  | { type: "insert"; after: number | null; block: CanvasBlockInput }
  | { type: "append"; block: CanvasBlockInput }
  | { type: "hooks"; options: string[]; replace: boolean }
  | { type: "title"; title: string };

export const CANVAS_LIMITS = {
  maxActions: 12,
  maxLabel: 60,
  maxText: 6000,
  maxItems: 30,
  maxItem: 400,
  maxHooks: 8,
  maxHook: 200,
  maxTitle: 120,
} as const;

const KINDS: readonly CanvasKind[] = [
  "paragraph",
  "bullets",
  "steps",
  "script",
];

const record = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseBlock(value: unknown): CanvasBlockInput | null {
  const raw = record(value);
  if (!raw) return null;
  const kind = KINDS.includes(raw.kind as CanvasKind)
    ? (raw.kind as CanvasKind)
    : Array.isArray(raw.items)
      ? "bullets"
      : "paragraph";
  const label = clip(raw.label, CANVAS_LIMITS.maxLabel);
  const items = Array.isArray(raw.items)
    ? raw.items
        .map((item) => clip(item, CANVAS_LIMITS.maxItem))
        .filter(Boolean)
        .slice(0, CANVAS_LIMITS.maxItems)
    : [];
  const text = clip(raw.text, CANVAS_LIMITS.maxText);
  const list = kind === "bullets" || kind === "steps";
  if (list && items.length === 0 && !text) return null;
  if (!list && !text && items.length === 0) return null;
  // A list written as prose, or prose written as a list, is still usable.
  if (list)
    return {
      label,
      kind,
      items: items.length
        ? items
        : text
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
    };
  return { label, kind, text: text || items.join("\n") };
}

/**
 * Reads the model's reply. Anything malformed is dropped rather than repaired
 * into something the model did not say. Indexes are checked against the
 * document the request was made for, so a stale reply cannot land on the
 * wrong block.
 */
export function parseCanvasActions(
  value: unknown,
  blockCount: number,
): CanvasAction[] {
  const root = record(value);
  const list = Array.isArray(root?.actions) ? root!.actions : [];
  const actions: CanvasAction[] = [];
  for (const entry of list.slice(0, CANVAS_LIMITS.maxActions)) {
    const raw = record(entry);
    if (!raw) continue;
    switch (raw.type) {
      case "replace": {
        const block = parseBlock(raw.block);
        const index = Number(raw.index);
        if (
          !block ||
          !Number.isInteger(index) ||
          index < 0 ||
          index >= blockCount
        )
          break;
        actions.push({ type: "replace", index, block });
        break;
      }
      case "insert": {
        const block = parseBlock(raw.block);
        if (!block) break;
        const after =
          raw.after === null || raw.after === undefined
            ? null
            : Number(raw.after);
        if (
          after !== null &&
          (!Number.isInteger(after) || after < 0 || after >= blockCount)
        )
          break;
        actions.push({ type: "insert", after, block });
        break;
      }
      case "append": {
        const block = parseBlock(raw.block);
        if (block) actions.push({ type: "append", block });
        break;
      }
      case "hooks": {
        const options = Array.isArray(raw.options)
          ? raw.options
              .map((option) => clip(option, CANVAS_LIMITS.maxHook))
              .filter(Boolean)
              .slice(0, CANVAS_LIMITS.maxHooks)
          : [];
        if (options.length)
          actions.push({
            type: "hooks",
            options,
            replace: raw.replace === true,
          });
        break;
      }
      case "title": {
        const title = clip(raw.title, CANVAS_LIMITS.maxTitle);
        if (title) actions.push({ type: "title", title });
        break;
      }
      default:
        break;
    }
  }
  return actions;
}

export interface CanvasState {
  title: string;
  blocks: CanvasBlock[];
  hooks: string[];
}

/**
 * Applies actions in order. Replace keeps the block's identity so the editor
 * does not lose focus or scroll; a replaced block also keeps its label when
 * the reply left the label blank, which models do when told "rewrite this".
 */
export function applyCanvasActions(
  state: CanvasState,
  actions: CanvasAction[],
): CanvasState {
  let { title, blocks, hooks } = state;
  const snapshot = blocks;
  for (const action of actions) {
    switch (action.type) {
      case "replace": {
        const target = snapshot[action.index];
        if (!target) break;
        blocks = blocks.map((block) =>
          block.id === target.id
            ? {
                ...block,
                label: action.block.label || block.label,
                kind: action.block.kind,
                text: action.block.text ?? "",
                items: action.block.items ?? [],
              }
            : block,
        );
        break;
      }
      case "insert": {
        const anchor =
          action.after === null ? null : (snapshot[action.after]?.id ?? null);
        blocks = insertBlockAfter(blocks, anchor, blockFrom(action.block));
        break;
      }
      case "append":
        blocks = [...blocks, blockFrom(action.block)];
        break;
      case "hooks":
        hooks = action.replace ? action.options : [...hooks, ...action.options];
        break;
      case "title":
        title = action.title;
        break;
    }
  }
  return { title, blocks, hooks };
}

/** The document as the model sees it: numbered, labelled, with its words. */
export function describeCanvas(blocks: CanvasBlock[]): string {
  if (blocks.length === 0) return "The canvas is empty.";
  return blocks
    .map((block, index) => {
      const body =
        block.kind === "bullets" || block.kind === "steps"
          ? block.items.map((item) => `- ${item}`).join("\n")
          : block.text;
      return `[${index}] ${block.label || "(untitled)"} (${block.kind})\n${body || "(empty)"}`;
    })
    .join("\n\n");
}

/** Bounded blocks for the request body. */
export function blocksForRequest(blocks: CanvasBlock[]): ContentBlock[] {
  return blocks.slice(0, 20).map((block) => ({
    label: block.label.slice(0, CANVAS_LIMITS.maxLabel),
    kind: block.kind,
    ...(block.kind === "bullets" || block.kind === "steps"
      ? {
          items: block.items
            .slice(0, CANVAS_LIMITS.maxItems)
            .map((i) => i.slice(0, CANVAS_LIMITS.maxItem)),
        }
      : { text: block.text.slice(0, CANVAS_LIMITS.maxText) }),
  }));
}
