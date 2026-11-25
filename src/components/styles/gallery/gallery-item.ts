import type { CatalogShelf } from "@/lib/style-library/catalog";
import type { AnyStyleDefinition } from "@/lib/style-library/format/style-definition";
import { STYLE_CATEGORIES } from "@/lib/style-library/format/style-category";
import { getStyle, STYLES } from "@/lib/style-library/registry";
import { TEMPLATES } from "@/lib/style-library/templates/registry";
import type { Template } from "@/lib/style-library/templates/template";

/** Something the gallery can open on the stage. */
export interface GalleryItem {
  key: string;
  group: string;
  name: string;
  summary: string;
  /** A rendered still for the list, when one exists. */
  poster: string | null;
  /** What goes on the stage. A single block is wrapped so the same workbench edits it. */
  template: Template;
  /** Where "Save to my looks" starts from. `null` for a single block. */
  saveFrom: string | null;
  /** Set for one of the creator's own looks, which saves in place. */
  lookId: string | null;
  durationS: number;
  /** The place opened first in the inspector. */
  firstPlace: string;
}

const TEMPLATE_S = 6;

/** A lone block as a one-layer template, over the full-frame take when it is an overlay. */
function blockTemplate(style: AnyStyleDefinition): Template {
  return {
    id: style.id,
    name: style.name,
    summary: style.summary,
    layers: [
      ...(style.layer === "overlay"
        ? [
            {
              id: "take",
              label: "The take",
              accepts: ["layouts" as const],
              block: { styleId: "layouts.full-frame" },
            },
          ]
        : []),
      {
        id: "block",
        label: style.name,
        accepts: [style.category],
        block: {
          styleId: style.id,
          options: style.preview.options,
          content: style.preview.content,
          slots: style.preview.slots,
        },
      },
    ],
  };
}

const shelfLabel = (id: string) =>
  STYLE_CATEGORIES.find((category) => category.id === id)?.label ?? id;

export const templateItems = (): GalleryItem[] =>
  TEMPLATES.map((template) => ({
    key: `template:${template.id}`,
    group: "Templates",
    name: template.name,
    summary: template.summary,
    poster: `/style-previews/template.${template.id}.jpg`,
    template,
    saveFrom: template.id,
    lookId: null,
    durationS: TEMPLATE_S,
    firstPlace: "layout",
  }));

export const blockItems = (): GalleryItem[] =>
  STYLES.map((style) => ({
    key: `block:${style.id}`,
    group: shelfLabel(style.category),
    name: style.name,
    summary: style.summary,
    poster: `/style-previews/${style.id}.jpg`,
    template: blockTemplate(style),
    saveFrom: null,
    lookId: null,
    durationS:
      style.output === "still"
        ? 0
        : Math.max(style.preview.durationS, TEMPLATE_S),
    firstPlace: "block",
  }));

/** A saved look as an item. Its poster is the template it started from, until looks get their own. */
export const lookItem = (look: {
  id: string;
  name: string;
  layers: Template["layers"];
}): GalleryItem => ({
  key: `look:${look.id}`,
  group: "My looks",
  name: look.name,
  summary: "",
  poster: null,
  template: { id: look.id, name: look.name, summary: "", layers: look.layers },
  saveFrom: look.id,
  lookId: look.id,
  durationS: TEMPLATE_S,
  firstPlace: "layout",
});

export type { CatalogShelf };
export { getStyle };
