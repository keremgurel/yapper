import { AbsoluteFill } from "remotion";
import { StyleRuntimeProvider } from "../../src/lib/style-library/runtime/style-runtime";
import type { Template } from "../../src/lib/style-library/templates/template";
import { TemplateView } from "../../src/lib/style-library/templates/TemplateView";
import { SAMPLE_MATERIAL } from "./sample-material";
import { useRemotionRuntime } from "./use-remotion-runtime";

export type TemplatePreviewProps = {
  previewId: string;
  posterS: number;
  /** The whole template as JSON. Edit it in Studio, or pass an edited one with --props. */
  template: Template;
};

/** A template on the sample take and words. */
export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
}) => {
  const runtime = useRemotionRuntime();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <StyleRuntimeProvider value={runtime}>
        <TemplateView template={template} material={SAMPLE_MATERIAL} samples />
      </StyleRuntimeProvider>
    </AbsoluteFill>
  );
};
