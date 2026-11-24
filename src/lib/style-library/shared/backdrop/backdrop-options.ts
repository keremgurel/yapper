import {
  colorOption,
  enumOption,
  mediaOption,
  numberOption,
} from "../../format/option-builders";

export type BackdropKind = "frosted" | "dots" | "color" | "image" | "video";

const when = (...values: BackdropKind[]) => ({
  option: "backdrop",
  in: values,
});

/**
 * The backdrop controls every layout shares, so "change the background" means
 * the same options whichever split is on screen. Blur and dim defaults were
 * matched to the Ep. 15 blurred take.
 */
export const backdropOptions = (initial: BackdropKind) =>
  ({
    backdrop: enumOption({
      label: "Backdrop",
      help: "What fills the frame behind the layout. Glass cards read best on the blurred take, plain screenshots on the dotted grid.",
      default: initial,
      choices: [
        { value: "frosted", label: "Blurred take" },
        { value: "dots", label: "Dotted grid" },
        { value: "color", label: "Flat colour" },
        { value: "image", label: "Your image" },
        { value: "video", label: "Your video" },
      ],
    }),
    backdropColor: colorOption({
      label: "Backdrop colour",
      default: "#0A0A0A",
      showWhen: when("dots", "color"),
    }),
    dotOpacity: numberOption({
      label: "Dot strength",
      default: 0.11,
      min: 0,
      max: 0.4,
      step: 0.01,
      unit: "ratio",
      showWhen: when("dots"),
    }),
    backdropMedia: mediaOption({
      label: "Backdrop media",
      accepts: ["image", "video"],
      showWhen: when("image", "video"),
    }),
    backdropBlur: numberOption({
      label: "Backdrop blur",
      default: 30,
      min: 0,
      max: 120,
      unit: "px",
      showWhen: when("frosted", "image", "video"),
    }),
    backdropDim: numberOption({
      label: "Backdrop dim",
      help: "How much the backdrop is darkened so white captions stay readable on the seam.",
      default: 0.5,
      min: 0,
      max: 0.9,
      step: 0.05,
      unit: "ratio",
      showWhen: when("frosted", "image", "video"),
    }),
  }) as const;

export type BackdropOptionSpecs = ReturnType<typeof backdropOptions>;
