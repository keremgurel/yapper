/**
 * The overlay scene format, as validated. See docs/overlay-scene-format.md,
 * which this file and the Swift `Models/Scene` mirror by hand.
 *
 * Every coordinate is a fraction of the overlay's own box: `x`/`width` of its
 * width, `y`/`height` of its height. Other sizes are fractions of the box
 * height. Times are seconds from the overlay's own start.
 */

export type SceneFont = "modern" | "rounded" | "editorial";
export type SceneWeight = "regular" | "medium" | "semibold" | "bold" | "black";
export type SceneAlign = "left" | "center" | "right";
export type SceneAnchor =
  | "center"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";
export type SceneNumberFormat =
  | "plain"
  | "grouped"
  | "percent"
  | "compact"
  | "decimal1";
export type SceneImageFit = "contain" | "cover";
export type SceneEasing =
  | "linear"
  | "inQuad"
  | "outQuad"
  | "inOutQuad"
  | "outCubic"
  | "inOutCubic"
  | "outExpo"
  | "outBack";
export type SceneProperty =
  | "opacity"
  | "x"
  | "y"
  | "scaleX"
  | "scaleY"
  | "scale"
  | "rotate"
  | "value"
  | "strokeEnd"
  | "width"
  | "height";

/** A hex colour or a brand token such as `brand.primary`. */
export type SceneColor = string;

interface SceneNodeBase {
  id: string;
  x: number;
  y: number;
  width: number;
  /** Optional on text and number nodes, which grow to fit their lines. */
  height: number;
  opacity: number;
  rotate: number;
  anchor: SceneAnchor;
}

interface SceneTypeFields {
  font: SceneFont;
  weight: SceneWeight;
  /** Fraction of the box height. */
  size: number;
  color: SceneColor;
  align: SceneAlign;
  /** Multiple of the font size, default 1.15. */
  lineHeight: number;
  uppercase: boolean;
}

export interface SceneTextNode extends SceneNodeBase, SceneTypeFields {
  type: "text";
  text: string;
}

export interface SceneNumberNode extends SceneNodeBase, SceneTypeFields {
  type: "number";
  from: number;
  to: number;
  format: SceneNumberFormat;
  prefix: string;
  suffix: string;
}

export interface SceneRectNode extends SceneNodeBase {
  type: "rect";
  fill?: SceneColor;
  stroke?: SceneColor;
  strokeWidth: number;
  cornerRadius: number;
}

export interface SceneEllipseNode extends SceneNodeBase {
  type: "ellipse";
  fill?: SceneColor;
  stroke?: SceneColor;
  strokeWidth: number;
}

export interface SceneLineNode extends SceneNodeBase {
  type: "line";
  x2: number;
  y2: number;
  stroke: SceneColor;
  strokeWidth: number;
  dashed: boolean;
}

export interface ScenePathNode extends SceneNodeBase {
  type: "path";
  /** SVG path data in a unit square mapped onto the node box. */
  d: string;
  fill?: SceneColor;
  stroke?: SceneColor;
  strokeWidth: number;
}

export interface SceneIconNode extends SceneNodeBase {
  type: "icon";
  icon: string;
  color: SceneColor;
  strokeWidth: number;
}

export interface SceneImageNode extends SceneNodeBase {
  type: "image";
  /** `brand.logo`, or `image:<key>` for a picture the design delivered. */
  asset: string;
  fit: SceneImageFit;
  cornerRadius: number;
}

export interface SceneGroupNode extends SceneNodeBase {
  type: "group";
  children: SceneNode[];
}

export type SceneNode =
  | SceneTextNode
  | SceneNumberNode
  | SceneRectNode
  | SceneEllipseNode
  | SceneLineNode
  | ScenePathNode
  | SceneIconNode
  | SceneImageNode
  | SceneGroupNode;

export type SceneNodeType = SceneNode["type"];

export interface SceneAnimation {
  /** A node id, or `*` for every top level node. */
  node: string;
  property: SceneProperty;
  /** Absent means the node's own value. */
  from?: number;
  to: number;
  start: number;
  end: number;
  easing: SceneEasing;
  /** Seconds between successive children when `node` is a group or `*`. */
  stagger: number;
}

export interface SceneBackground {
  fill: SceneColor;
  cornerRadius: number;
  opacity: number;
}

export interface OverlayScene {
  version: 1;
  duration: number;
  poster: number;
  background?: SceneBackground;
  nodes: SceneNode[];
  animations: SceneAnimation[];
}

/** A picture the designer asked to have generated for an `image:<key>` node. */
export interface SceneImageRequest {
  key: string;
  prompt: string;
  /** Width over height. */
  aspect: number;
}

export const SCENE_FONTS: readonly SceneFont[] = [
  "modern",
  "rounded",
  "editorial",
];
export const SCENE_WEIGHTS: readonly SceneWeight[] = [
  "regular",
  "medium",
  "semibold",
  "bold",
  "black",
];
export const SCENE_ALIGNS: readonly SceneAlign[] = ["left", "center", "right"];
export const SCENE_ANCHORS: readonly SceneAnchor[] = [
  "center",
  "left",
  "right",
  "top",
  "bottom",
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
];
export const SCENE_NUMBER_FORMATS: readonly SceneNumberFormat[] = [
  "plain",
  "grouped",
  "percent",
  "compact",
  "decimal1",
];
export const SCENE_IMAGE_FITS: readonly SceneImageFit[] = ["contain", "cover"];
export const SCENE_EASINGS: readonly SceneEasing[] = [
  "linear",
  "inQuad",
  "outQuad",
  "inOutQuad",
  "outCubic",
  "inOutCubic",
  "outExpo",
  "outBack",
];
export const SCENE_PROPERTIES: readonly SceneProperty[] = [
  "opacity",
  "x",
  "y",
  "scaleX",
  "scaleY",
  "scale",
  "rotate",
  "value",
  "strokeEnd",
  "width",
  "height",
];
export const SCENE_NODE_TYPES: readonly SceneNodeType[] = [
  "text",
  "number",
  "rect",
  "ellipse",
  "line",
  "path",
  "icon",
  "image",
  "group",
];
