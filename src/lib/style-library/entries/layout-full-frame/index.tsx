import { numberOption } from "../../format/option-builders";
import { defineStyle, type StyleProps } from "../../format/style-definition";
import { DesignFrame } from "../../runtime/design-frame";
import { useStyleMedia } from "../../runtime/style-runtime";
import { SAMPLE_TAKE } from "../../samples/sample-take";
import { takeContent } from "../../shared/take-content";

const fullFrameOptions = {
  zoom: numberOption({
    label: "Punch in",
    help: "1 shows the whole take. Above 1 crops closer to the speaker.",
    default: 1,
    min: 1,
    max: 1.6,
    step: 0.02,
    unit: "ratio",
  }),
  focusY: numberOption({
    label: "Vertical focus",
    help: "What a punch-in keeps in frame. 0 is the top of the take, 1 the bottom.",
    default: 0.35,
    min: 0,
    max: 1,
    step: 0.05,
    unit: "ratio",
  }),
} as const;

/** The take on the whole frame: the plain talking head every other layout cuts away from. */
function FullFrame({
  options,
  content,
}: StyleProps<typeof fullFrameOptions, typeof takeContent>) {
  const { Video } = useStyleMedia();
  if (!content.take) return null;
  return (
    <DesignFrame style={{ backgroundColor: "#000000" }}>
      <Video
        src={content.take}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${options.zoom})`,
          transformOrigin: `50% ${options.focusY * 100}%`,
        }}
      />
    </DesignFrame>
  );
}

export const fullFrame = defineStyle({
  id: "layouts.full-frame",
  version: 1,
  name: "Full frame",
  category: "layouts",
  weight: "native",
  summary:
    "The take on the whole frame, with an optional punch-in. What a phone records, and the base for captions and floating cards.",
  output: "video",
  layer: "frame",
  fonts: [],
  options: fullFrameOptions,
  content: takeContent,
  rules: [
    {
      rule: "Leave the take alone by default. A punch-in is a choice for emphasis and stays small.",
      why: "Added for the library. No reference was measured for it.",
    },
  ],
  preview: {
    durationS: 3,
    posterS: 1.5,
    content: { take: SAMPLE_TAKE },
  },
  Component: FullFrame,
});
