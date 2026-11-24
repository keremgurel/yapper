import { getStyle } from "../registry";
import type { ProjectMaterial } from "../project-material";
import { StyleBlockView } from "../StyleBlockView";
import { captionHeight } from "./caption-height";
import type { Template } from "./template";

/** A template on a project's take and words, layers drawn bottom to top. */
export function TemplateView({
  template,
  material,
  samples = false,
}: {
  template: Template;
  material: ProjectMaterial;
  /** For a preview: fill blocks that have no content yet with their samples. */
  samples?: boolean;
}) {
  const seam = captionHeight(template);
  return (
    <>
      {template.layers.map(({ id, block }) => {
        if (!block) return null;
        const captions = getStyle(block.styleId)?.category === "captions";
        return (
          <StyleBlockView
            key={id}
            block={block}
            material={material}
            samples={samples}
            defaults={captions && seam !== null ? { y: seam } : undefined}
          />
        );
      })}
    </>
  );
}
