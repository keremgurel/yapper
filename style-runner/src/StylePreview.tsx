import { AbsoluteFill } from "remotion";
import { getStyle } from "../../src/lib/style-library/registry";
import { StyleRuntimeProvider } from "../../src/lib/style-library/runtime/style-runtime";
import { StyleBlockView } from "../../src/lib/style-library/StyleBlockView";
import { SAMPLE_MATERIAL } from "./sample-material";
import { useRemotionRuntime } from "./use-remotion-runtime";

// A type, not an interface: Remotion needs props assignable to a plain record.
export type StylePreviewProps = {
  /** Names the rendered files. The component ignores it. */
  previewId: string;
  /** Read by the preview script to pick the still. The component ignores it. */
  posterS: number;
  styleId: string;
  options: Record<string, unknown>;
  content: Record<string, unknown>;
};

/** One building block on the sample take, with the sample blocks in its slots. */
export const StylePreview: React.FC<StylePreviewProps> = ({
  styleId,
  options,
  content,
}) => {
  const runtime = useRemotionRuntime();
  const style = getStyle(styleId);
  if (!style) throw new Error(`No style called '${styleId}'.`);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <StyleRuntimeProvider value={runtime}>
        {style.layer === "overlay" ? (
          <StyleBlockView
            block={{ styleId: "layouts.full-frame" }}
            material={SAMPLE_MATERIAL}
          />
        ) : null}
        <StyleBlockView
          block={{ styleId, options, content, slots: style.preview.slots }}
          material={SAMPLE_MATERIAL}
          samples
        />
      </StyleRuntimeProvider>
    </AbsoluteFill>
  );
};
