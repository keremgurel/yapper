import type { OptionValues } from "../../format/option-spec";
import { DotGrid } from "../DotGrid";
import type { BackdropOptionSpecs } from "./backdrop-options";
import { BlurredMedia } from "./BlurredMedia";

/** What fills the frame behind a layout. Falls back to the flat colour when media is missing. */
export function Backdrop({
  options,
  take,
}: {
  options: OptionValues<BackdropOptionSpecs>;
  take: string | null;
}) {
  const { backdrop, backdropColor, backdropMedia } = options;
  const blurred = { blur: options.backdropBlur, dim: options.backdropDim };

  if (backdrop === "frosted" && take) {
    return <BlurredMedia kind="video" src={take} {...blurred} />;
  }
  if ((backdrop === "image" || backdrop === "video") && backdropMedia) {
    return <BlurredMedia kind={backdrop} src={backdropMedia} {...blurred} />;
  }
  if (backdrop === "dots") {
    return (
      <DotGrid
        base={backdropColor}
        spacing={24}
        dot={1.3}
        opacity={options.dotOpacity}
      />
    );
  }
  return (
    <div
      style={{ position: "absolute", inset: 0, backgroundColor: backdropColor }}
    />
  );
}
