import {
  booleanOption,
  enumOption,
  mediaOption,
  numberOption,
} from "../../format/option-builders";
import { defineStyle, type StyleProps } from "../../format/style-definition";
import { DesignFrame } from "../../runtime/design-frame";
import { useStyleMedia } from "../../runtime/style-runtime";
import { SAMPLE_SCREENSHOT } from "../../samples/sample-take";
import { FloatTop } from "../../shared/FloatTop";

const mediaBlockOptions = {
  fit: enumOption({
    label: "Fit",
    help: "Fill crops the picture to cover its area. Whole shows all of it.",
    default: "cover",
    choices: [
      { value: "cover", label: "Fill the area" },
      { value: "contain", label: "Show it whole" },
    ],
  }),
  focusY: numberOption({
    label: "Vertical focus",
    help: "Which part survives the crop when the picture fills its area. 0 is the top, 1 the bottom.",
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
    unit: "ratio",
    showWhen: { option: "fit", in: ["cover"] },
  }),
  width: numberOption({
    label: "Width over the speaker",
    help: "Used when the picture floats over the full frame. Inside a split it takes the area it is given.",
    default: 760,
    min: 300,
    max: 1080,
    unit: "px",
    showWhen: { option: "fit", in: ["contain"] },
  }),
  top: numberOption({
    label: "Distance from the top",
    default: 140,
    min: 60,
    max: 1200,
    unit: "px",
    showWhen: { option: "fit", in: ["contain"] },
  }),
  cornerRadius: numberOption({
    label: "Corner radius",
    default: 0,
    min: 0,
    max: 80,
    unit: "px",
  }),
  shadow: booleanOption({ label: "Shadow", default: false }),
} as const;

const mediaBlockContent = {
  src: mediaOption({
    label: "Picture or clip",
    accepts: ["image", "video"],
  }),
} as const;

const VIDEO = /\.(mp4|mov|webm|m4v)(\?|#|$)/i;

/**
 * A screenshot, picture or clip: the real thing, shown instead of described.
 * In a slot it takes the area it is given. On the full frame it either covers
 * everything (a cutaway) or floats whole near the top over the speaker.
 */
function MediaBlock({
  options,
  content,
  placement,
}: StyleProps<typeof mediaBlockOptions, typeof mediaBlockContent>) {
  const { Video, Image } = useStyleMedia();
  if (!content.src) return null;
  const Media = VIDEO.test(content.src) ? Video : Image;
  const cover = options.fit === "cover";
  const floating = placement === "frame" && !cover;
  const media = (
    <Media
      src={content.src}
      muted
      alt=""
      style={{
        width: cover ? "100%" : floating ? options.width : undefined,
        height: cover ? "100%" : undefined,
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: options.fit,
        objectPosition: `50% ${options.focusY * 100}%`,
        borderRadius: options.cornerRadius,
        boxShadow: options.shadow ? "0 24px 60px rgba(0,0,0,0.45)" : undefined,
      }}
    />
  );
  if (placement === "slot") return media;
  if (floating) return <FloatTop top={options.top}>{media}</FloatTop>;
  return <DesignFrame>{media}</DesignFrame>;
}

export const mediaBlock = defineStyle({
  id: "overlays.media",
  version: 1,
  name: "Picture or clip",
  category: "overlays",
  weight: "native",
  summary:
    "A screenshot, picture or clip that fills its area or is shown whole. The usual top half of a split.",
  output: "video",
  layer: "overlay",
  fonts: [],
  options: mediaBlockOptions,
  content: mediaBlockContent,
  rules: [
    {
      rule: "Show the real thing: a screen recording, a screenshot, the actual ad.",
      why: "Invented overlay graphics are kept to a minimum on purpose.",
    },
    {
      rule: "Floating over the speaker, a screenshot sits high in the frame at 760 px wide with 26 px corners and a soft shadow.",
      why: "Measured off a dashboard card in the reference edit.",
    },
    {
      rule: "Blur the names of private people in any screenshot or email before it goes in.",
    },
    {
      rule: "A clip here is silent. The take keeps the only voice.",
      why: "Added for the library.",
    },
  ],
  preview: {
    durationS: 3,
    posterS: 1.5,
    // The real dashboard card high in the frame, as the MRR card sat in Ep. 15.
    options: { fit: "contain", cornerRadius: 26, shadow: true },
    content: { src: SAMPLE_SCREENSHOT },
  },
  Component: MediaBlock,
});
