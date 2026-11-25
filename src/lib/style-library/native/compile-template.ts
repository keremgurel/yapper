import { captionHeight } from "../templates/caption-height";
import type { Template } from "../templates/template";
import { TEMPLATES } from "../templates/registry";
import { compileBackdrop } from "./compile-backdrop";
import { compileCaptions } from "./compile-captions";
import { compileLayout } from "./compile-layout";
import type { NativeStyleCatalog, NativeStylePlan } from "./native-plan";

const blockAt = (template: Template, layer: string) =>
  template.layers.find((item) => item.id === layer)?.block ?? null;

/**
 * A template in the Mac editor's terms, or the reason it cannot be one. The
 * layout decides: a template whose layout the editor cannot draw is left out
 * whole, because the rest of it was arranged around that layout.
 */
export function compileTemplate(
  template: Template,
): NativeStylePlan | { skipped: string } {
  const layoutBlock = blockAt(template, "layout");
  const layout = compileLayout(layoutBlock);
  if (!layout) {
    return {
      skipped: `The ${layoutBlock?.styleId ?? "missing"} layout is not in the editor yet.`,
    };
  }
  const backdrop = compileBackdrop(layout.backdropOptions);
  const captions = compileCaptions(
    blockAt(template, "captions"),
    captionHeight(template),
  );
  const overlay = blockAt(template, "overlay");
  return {
    id: template.id,
    name: template.name,
    summary: template.summary,
    layout: layout.layout,
    backdrop: backdrop.backdrop,
    captions: captions.captions,
    unsupported: [
      ...layout.unsupported,
      ...backdrop.unsupported,
      ...captions.unsupported,
      ...(overlay
        ? [`${overlay.styleId} over the speaker is not in the editor yet.`]
        : []),
    ],
  };
}

/** Every first-party template the editor can apply. Bundled with the Mac app. */
export function nativeStyleCatalog(
  templates: readonly Template[] = TEMPLATES,
): NativeStyleCatalog {
  const catalog: NativeStyleCatalog = {
    version: 1,
    templates: [],
    skipped: [],
  };
  for (const template of templates) {
    const compiled = compileTemplate(template);
    if ("skipped" in compiled) {
      catalog.skipped.push({ id: template.id, reason: compiled.skipped });
    } else {
      catalog.templates.push(compiled);
    }
  }
  return catalog;
}
