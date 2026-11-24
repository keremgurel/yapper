import type { StyleProps } from "../../format/style-definition";
import { DESIGN_FRAME, DesignFrame } from "../../runtime/design-frame";
import { Backdrop } from "../../shared/backdrop/Backdrop";
import type { TakeContentSpecs } from "../../shared/take-content";
import { CameraArea } from "./CameraArea";
import type { HalfOptionSpecs } from "./options";
import { TopArea } from "./TopArea";

/** Camera below, anything above. Two hard-edged halves with no cards and no travel. */
export function SplitHalfAndHalf({
  options,
  content,
  slots,
}: StyleProps<HalfOptionSpecs, TakeContentSpecs>) {
  return (
    <DesignFrame style={{ backgroundColor: "#000000" }}>
      <Backdrop options={options} take={content.take} />
      {slots.top ? (
        <TopArea height={options.splitAt} inset={options.visualInset}>
          {slots.top}
        </TopArea>
      ) : null}
      {content.take ? (
        <CameraArea
          take={content.take}
          top={options.splitAt}
          zoom={options.cameraZoom}
          focusY={options.cameraFocusY}
        />
      ) : null}
      {options.seamLine ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: options.splitAt - 1,
            width: DESIGN_FRAME.width,
            height: 2,
            backgroundColor: "rgba(255,255,255,0.16)",
          }}
        />
      ) : null}
    </DesignFrame>
  );
}
