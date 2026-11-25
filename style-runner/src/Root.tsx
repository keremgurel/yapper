import { Composition } from "remotion";
import { z } from "zod";
import {
  resolveContent,
  resolveOptions,
} from "../../src/lib/style-library/format/resolve-values";
import { DESIGN_FRAME } from "../../src/lib/style-library/runtime/design-frame";
import { STYLES } from "../../src/lib/style-library/registry";
import { TEMPLATES } from "../../src/lib/style-library/templates/registry";
import { loadStyleFonts } from "./load-fonts";
import { StylePreview } from "./StylePreview";
import { TemplatePreview } from "./TemplatePreview";
import { zodFromSpecs } from "./zod-from-specs";

const FPS = 30;
const TEMPLATE_S = 6;
const frame = {
  width: DESIGN_FRAME.width,
  height: DESIGN_FRAME.height,
  fps: FPS,
};

loadStyleFonts(STYLES.flatMap((style) => style.fonts));

/** Remotion ids allow letters, digits and hyphens, so `splits.speaker-below` becomes `splits-speaker-below`. */
export const compositionId = (id: string) => id.replace(/\./g, "-");

/** One composition per template and per building block, with its settings as editable props. */
export const Root: React.FC = () => (
  <>
    {TEMPLATES.map((template) => (
      <Composition
        key={template.id}
        id={compositionId(`template.${template.id}`)}
        component={TemplatePreview}
        {...frame}
        durationInFrames={TEMPLATE_S * FPS}
        schema={z.object({
          previewId: z.string(),
          posterS: z.number(),
          template: z.any(),
        })}
        defaultProps={{
          previewId: `template.${template.id}`,
          posterS: 2.2,
          template,
        }}
      />
    ))}
    {STYLES.map((style) => (
      <Composition
        key={style.id}
        id={compositionId(style.id)}
        component={StylePreview}
        {...frame}
        durationInFrames={Math.max(
          1,
          Math.round(style.preview.durationS * FPS),
        )}
        schema={z.object({
          previewId: z.string(),
          posterS: z.number(),
          styleId: z.string(),
          options: zodFromSpecs(style.options),
          content: z.record(z.string(), z.any()),
        })}
        defaultProps={{
          previewId: style.id,
          posterS: style.preview.posterS,
          styleId: style.id,
          options: resolveOptions(style.options, style.preview.options).values,
          content: resolveContent(style.content, style.preview.content).values,
        }}
      />
    ))}
  </>
);
