import type { StyleProps } from "../../format/style-definition";
import { DesignFrame } from "../../runtime/design-frame";
import { Backdrop } from "../../shared/backdrop/Backdrop";
import type { TakeContentSpecs } from "../../shared/take-content";
import type { SplitOptionSpecs } from "./options";
import { SpeakerCard } from "./SpeakerCard";
import { splitGeometry } from "./split-geometry";
import { VisualBox } from "./VisualBox";

/**
 * The speaker shrinks to the bottom of the frame, aspect kept, and a visual
 * takes the top. The layout cuts in whole, with no travel, so captions never
 * slide.
 */
export function SplitSpeakerBelow({
  options,
  content,
  slots,
}: StyleProps<SplitOptionSpecs, TakeContentSpecs>) {
  const geometry = splitGeometry(options);
  return (
    <DesignFrame style={{ backgroundColor: "#000000" }}>
      <Backdrop options={options} take={content.take} />
      {content.take ? (
        <SpeakerCard
          take={content.take}
          geometry={geometry}
          radius={options.cornerRadius}
          edgeLine={options.edgeLine}
        />
      ) : null}
      {slots.visual ? (
        <VisualBox box={geometry.visual}>{slots.visual}</VisualBox>
      ) : null}
    </DesignFrame>
  );
}
