import { resolveContent, resolveOptions } from "../format/resolve-values";
import type { StyleBlock } from "../format/style-block";
import type { AnyStyleDefinition } from "../format/style-definition";
import { getStyle, STYLES } from "../registry";
import type { Template } from "./template";
import { listPlaces, replaceAt, type TemplatePlace } from "./template-places";

/**
 * The four things anyone can do to a template. The inspector, a Chirpy action
 * and a connector tool all send these, so a change made by hand and one made
 * by a model go through the same checks.
 */
export type TemplateEdit =
  | { op: "setOptions"; at: string; options: Record<string, unknown> }
  | { op: "setContent"; at: string; content: Record<string, unknown> }
  | {
      op: "setBlock";
      at: string;
      styleId: string;
      options?: Record<string, unknown>;
      content?: Record<string, unknown>;
    }
  | { op: "clear"; at: string };

export type EditFailure =
  | "unknown_edit"
  | "unknown_place"
  | "empty_place"
  | "unknown_style"
  | "not_accepted";

export type EditResult =
  | { ok: true; template: Template; notes: string[] }
  | {
      ok: false;
      reason: EditFailure;
      /** A sentence a person or a model can act on. */
      message: string;
      /** What would have been accepted instead. */
      valid: string[];
    };

const fail = (
  reason: EditFailure,
  message: string,
  valid: string[],
): EditResult => ({
  ok: false,
  reason,
  message,
  valid,
});

const EDIT_OPS: readonly TemplateEdit["op"][] = [
  "setOptions",
  "setContent",
  "setBlock",
  "clear",
];

/** Ids of the blocks a place takes. */
export const stylesFor = (place: Pick<TemplatePlace, "accepts">): string[] =>
  STYLES.filter((style) => place.accepts.includes(style.category)).map(
    (style) => style.id,
  );

/** Keeps the keys the style knows, with the value the validator settled on. */
function kept<T extends Record<string, unknown>>(
  sent: Record<string, unknown>,
  resolved: T,
) {
  return Object.fromEntries(
    Object.keys(sent)
      .filter((key) => key in resolved)
      .map((key) => [key, resolved[key]]),
  );
}

function withValues(
  style: AnyStyleDefinition,
  block: StyleBlock,
  options: Record<string, unknown>,
  content: Record<string, unknown>,
): { block: StyleBlock; notes: string[] } {
  const o = resolveOptions(style.options, options);
  const c = resolveContent(style.content, content);
  return {
    block: {
      ...block,
      options: kept(options, o.values),
      content: kept(content, c.values),
    },
    notes: [...o.notes, ...c.notes],
  };
}

/** Moves the blocks in the old style's slots into the new style's slots, in order, where they are accepted. */
function carriedSlots(
  from: StyleBlock | null,
  to: AnyStyleDefinition,
): StyleBlock["slots"] {
  const children = Object.values(from?.slots ?? {}).filter(
    (child) => child !== null,
  );
  const slots: NonNullable<StyleBlock["slots"]> = {};
  Object.entries(to.slots ?? {}).forEach(([name, spec], index) => {
    const child = children[index];
    const category = child && getStyle(child.styleId)?.category;
    if (child && category && spec.accepts.includes(category))
      slots[name] = child;
  });
  return slots;
}

/** Applies one edit and returns the new template, or says exactly why it could not. */
export function editTemplate(
  template: Template,
  edit: TemplateEdit,
): EditResult {
  if (!EDIT_OPS.includes(edit.op)) {
    return fail(
      "unknown_edit",
      `There is no edit called '${String(edit.op)}'.`,
      [...EDIT_OPS],
    );
  }
  const places = listPlaces(template);
  const place = places.find((candidate) => candidate.path === edit.at);
  if (!place) {
    return fail(
      "unknown_place",
      `This template has no place called '${edit.at}'.`,
      places.map((candidate) => candidate.path),
    );
  }

  if (edit.op === "clear") {
    return {
      ok: true,
      template: replaceAt(template, place.path, null),
      notes: [],
    };
  }

  if (edit.op === "setBlock") {
    const style = getStyle(edit.styleId);
    if (!style) {
      return fail(
        "unknown_style",
        `There is no style called '${edit.styleId}'.`,
        stylesFor(place),
      );
    }
    if (!place.accepts.includes(style.category)) {
      return fail(
        "not_accepted",
        `'${place.path}' takes ${place.accepts.join(" or ")}, and '${style.id}' is from ${style.category}.`,
        stylesFor(place),
      );
    }
    const next = withValues(
      style,
      { styleId: style.id, slots: carriedSlots(place.block, style) },
      edit.options ?? {},
      edit.content ?? {},
    );
    return {
      ok: true,
      template: replaceAt(template, place.path, next.block),
      notes: next.notes,
    };
  }

  const style = place.block && getStyle(place.block.styleId);
  if (!place.block || !style) {
    return fail(
      "empty_place",
      `'${place.path}' is empty. Put a block there first.`,
      stylesFor(place),
    );
  }
  const next = withValues(
    style,
    place.block,
    {
      ...place.block.options,
      ...(edit.op === "setOptions" ? edit.options : {}),
    },
    {
      ...place.block.content,
      ...(edit.op === "setContent" ? edit.content : {}),
    },
  );
  return {
    ok: true,
    template: replaceAt(template, place.path, next.block),
    notes: next.notes,
  };
}
