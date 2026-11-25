/**
 * A template said in the Mac editor's own terms. Lengths are fractions of the
 * frame, measured from the top left, as the editor stores them. The caption
 * style and the backdrop use the same shapes as the `editor.captions.setStyle`
 * and `editor.project.setBackdrop` actions, so the app applies them through
 * the executors those actions already have.
 */
export interface NativeStylePlan {
  id: string;
  name: string;
  summary: string;
  layout: NativeLayout;
  backdrop: NativeBackdrop | null;
  captions: NativeCaptions | null;
  /** Parts of the template the editor cannot draw yet, said plainly. */
  unsupported: string[];
}

export interface NativeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the camera goes. `fullFrame` leaves it as every project has it today.
 * `split` draws it only inside `camera`, cropped to fill, and keeps `top` for
 * the visual.
 */
export type NativeLayout =
  | { kind: "fullFrame" }
  | {
      kind: "split";
      camera: NativeBox;
      /** 1 fills the camera box. Higher crops closer. */
      cameraZoom: number;
      /** Which part of the take stays in view: 0 the top, 1 the bottom. */
      cameraFocusY: number;
      top: NativeBox;
    };

/** The `editor.project.setBackdrop` input. */
export interface NativeBackdrop {
  color?: string;
  preset?: "shapeGrid";
  presetColors?: string[];
}

export interface NativeCaptions {
  /** The `TextStyleInput` of `editor.captions.setStyle`. */
  style: {
    x: number;
    y: number;
    width: number;
    fontScale: number;
    font: "modern";
    color: string;
    strokeEnabled: boolean;
    backgroundEnabled: boolean;
    shadowEnabled: boolean;
  };
  wordsPerCard: number;
}

/** What is bundled with the Mac app. */
export interface NativeStyleCatalog {
  version: 1;
  templates: NativeStylePlan[];
  /** Templates left out, with the reason. */
  skipped: { id: string; reason: string }[];
}
