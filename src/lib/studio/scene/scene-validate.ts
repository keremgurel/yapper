import { normalizeSceneColor } from "./scene-colors";
import { isKnownSceneIcon } from "./scene-icons";
import { SCENE_LIMITS } from "./scene-limits";
import {
  SCENE_ALIGNS,
  SCENE_ANCHORS,
  SCENE_EASINGS,
  SCENE_FONTS,
  SCENE_IMAGE_FITS,
  SCENE_NUMBER_FORMATS,
  SCENE_PROPERTIES,
  SCENE_WEIGHTS,
  type OverlayScene,
  type SceneAnimation,
  type SceneNode,
  type SceneProperty,
} from "./scene-types";

/**
 * Turns whatever the model wrote into a scene the renderer can draw, or
 * nothing.
 *
 * Repairs where a repair is harmless (a fraction out of range is clamped, a
 * missing easing gets the default) and drops where it is not (an unknown
 * node type, an icon that does not exist, a path that is not path data),
 * saying so in `notes` so the reply can tell the creator. The scene is only
 * rejected outright when nothing usable is left. The Swift `SceneValidator`
 * applies the same rules; docs/overlay-scene-format.md is the contract.
 */
export interface SceneValidationOptions {
  /** Image keys the design reply actually delivered. */
  imageKeys?: readonly string[];
  hasBrandLogo?: boolean;
  /** Height of the finished frame, for the legibility floor. */
  frameHeightPx?: number;
  /** Height of the box the scene is drawn into, for the same. */
  boxHeightPx?: number;
}

export interface SceneValidation {
  scene: OverlayScene;
  notes: string[];
}

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const PATH_DATA = /^[MmZzLlHhVvCcSsQqTtAa0-9\s,.\-+eE]+$/;
const KEY = /^[A-Za-z0-9_-]{1,40}$/;

type Raw = Record<string, unknown>;

const record = (value: unknown): Raw | null =>
  value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : null;

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function num(value: unknown, fallback: number, min: number, max: number) {
  return finite(value) ? clamp(value, min, max) : fallback;
}

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

class Budget {
  nodes = 0;
  images = 0;
  readonly notes: string[] = [];
  readonly ids = new Set<string>();
  constructor(readonly options: SceneValidationOptions) {}

  note(text: string) {
    if (this.notes.length < 12 && !this.notes.includes(text))
      this.notes.push(text);
  }

  uniqueId(raw: unknown, index: number): string {
    let id = typeof raw === "string" && ID.test(raw) ? raw : `node${index + 1}`;
    let n = 2;
    while (this.ids.has(id)) id = `${id}-${n++}`;
    this.ids.add(id);
    return id;
  }
}

function legibleSize(size: number, budget: Budget): number {
  const { frameHeightPx, boxHeightPx } = budget.options;
  if (!frameHeightPx || !boxHeightPx) return size;
  const floor =
    (SCENE_LIMITS.minLegibleFrameFraction * frameHeightPx) / boxHeightPx;
  if (size >= floor) return size;
  budget.note("Text is below the readable size and needs redesign.");
  // Changing font size without recomposing the surrounding layout corrupts
  // the design. The quality pass must ask the designer to repair it instead.
  return size;
}

function typeFields(raw: Raw, budget: Budget) {
  const { textSize, lineHeight } = SCENE_LIMITS;
  return {
    font: pick(raw.font, SCENE_FONTS, "modern"),
    weight: pick(raw.weight, SCENE_WEIGHTS, "bold"),
    size: legibleSize(num(raw.size, 0.12, textSize.min, textSize.max), budget),
    color: normalizeSceneColor(raw.color) ?? "brand.ink",
    align: pick(raw.align, SCENE_ALIGNS, "left"),
    lineHeight: num(raw.lineHeight, 1.15, lineHeight.min, lineHeight.max),
    uppercase: raw.uppercase === true,
  };
}

function baseFields(raw: Raw, id: string, autoHeight: boolean) {
  const { position, size } = SCENE_LIMITS;
  const width = num(raw.width, NaN, size.min, size.max);
  const height = num(raw.height, NaN, size.min, size.max);
  if (!Number.isFinite(width)) return null;
  if (!Number.isFinite(height) && !autoHeight) return null;
  return {
    id,
    x: num(raw.x, 0, position.min, position.max),
    y: num(raw.y, 0, position.min, position.max),
    width,
    height: Number.isFinite(height) ? height : 0,
    opacity: num(raw.opacity, 1, 0, 1),
    rotate: num(raw.rotate, 0, -360, 360),
    anchor: pick(raw.anchor, SCENE_ANCHORS, "center"),
  };
}

function validateNode(
  value: unknown,
  index: number,
  depth: number,
  budget: Budget,
): SceneNode | null {
  const raw = record(value);
  if (!raw) return null;
  if (budget.nodes >= SCENE_LIMITS.maxNodes) {
    budget.note(`Left out nodes past the limit of ${SCENE_LIMITS.maxNodes}.`);
    return null;
  }
  const type = typeof raw.type === "string" ? raw.type : "";
  const id = budget.uniqueId(raw.id, index);
  const { strokeWidth, cornerRadius } = SCENE_LIMITS;
  const stroke = (v: unknown) => num(v, 0.01, strokeWidth.min, strokeWidth.max);
  const radius = (v: unknown) => num(v, 0, cornerRadius.min, cornerRadius.max);

  let node: SceneNode | null = null;
  switch (type) {
    case "text": {
      const base = baseFields(raw, id, true);
      const text = str(raw.text, SCENE_LIMITS.maxTextLength);
      if (!base || !text) break;
      if (
        typeof raw.text === "string" &&
        raw.text.trim().length > SCENE_LIMITS.maxTextLength
      ) {
        budget.note(
          `Shortened "${id}" to ${SCENE_LIMITS.maxTextLength} characters.`,
        );
      }
      const fields = typeFields(raw, budget);
      node = {
        ...base,
        ...fields,
        type: "text",
        text,
        height: base.height || fields.size * fields.lineHeight * 1.2,
      };
      break;
    }
    case "number": {
      const base = baseFields(raw, id, true);
      if (!base || !finite(raw.from) || !finite(raw.to)) break;
      const fields = typeFields(raw, budget);
      node = {
        ...base,
        ...fields,
        type: "number",
        from: raw.from,
        to: raw.to,
        format: pick(raw.format, SCENE_NUMBER_FORMATS, "grouped"),
        prefix: str(raw.prefix, 8),
        suffix: str(raw.suffix, 8),
        height: base.height || fields.size * fields.lineHeight * 1.2,
      };
      break;
    }
    case "rect": {
      const base = baseFields(raw, id, false);
      if (!base) break;
      const fill = normalizeSceneColor(raw.fill);
      const strokeColor = normalizeSceneColor(raw.stroke);
      node = {
        ...base,
        type: "rect",
        fill: fill ?? (strokeColor ? undefined : "brand.primary"),
        stroke: strokeColor ?? undefined,
        strokeWidth: stroke(raw.strokeWidth),
        cornerRadius: radius(raw.cornerRadius),
      };
      break;
    }
    case "ellipse": {
      const base = baseFields(raw, id, false);
      if (!base) break;
      const fill = normalizeSceneColor(raw.fill);
      const strokeColor = normalizeSceneColor(raw.stroke);
      node = {
        ...base,
        type: "ellipse",
        fill: fill ?? (strokeColor ? undefined : "brand.primary"),
        stroke: strokeColor ?? undefined,
        strokeWidth: stroke(raw.strokeWidth),
      };
      break;
    }
    case "line": {
      const { position } = SCENE_LIMITS;
      if (
        !finite(raw.x) ||
        !finite(raw.y) ||
        !finite(raw.x2) ||
        !finite(raw.y2)
      )
        break;
      const x = clamp(raw.x, position.min, position.max);
      const y = clamp(raw.y, position.min, position.max);
      const x2 = clamp(raw.x2, position.min, position.max);
      const y2 = clamp(raw.y2, position.min, position.max);
      node = {
        id,
        type: "line",
        x,
        y,
        x2,
        y2,
        width: Math.max(SCENE_LIMITS.size.min, Math.abs(x2 - x)),
        height: Math.max(SCENE_LIMITS.size.min, Math.abs(y2 - y)),
        opacity: num(raw.opacity, 1, 0, 1),
        rotate: 0,
        anchor: "center",
        stroke: normalizeSceneColor(raw.stroke) ?? "brand.ink",
        strokeWidth: stroke(raw.strokeWidth),
        dashed: raw.dashed === true,
      };
      break;
    }
    case "path": {
      const base = baseFields(raw, id, false);
      const d = typeof raw.d === "string" ? raw.d.trim() : "";
      if (
        !base ||
        !d ||
        d.length > SCENE_LIMITS.maxPathBytes ||
        !PATH_DATA.test(d)
      ) {
        if (base)
          budget.note(`Dropped "${id}": its path data could not be read.`);
        break;
      }
      const fill = normalizeSceneColor(raw.fill);
      const strokeColor = normalizeSceneColor(raw.stroke);
      node = {
        ...base,
        type: "path",
        d,
        fill: fill ?? undefined,
        stroke: strokeColor ?? (fill ? undefined : "brand.ink"),
        strokeWidth: stroke(raw.strokeWidth),
      };
      break;
    }
    case "icon": {
      const base = baseFields(raw, id, false);
      if (!base) break;
      if (!isKnownSceneIcon(raw.icon)) {
        budget.note(
          `Dropped "${id}": there is no icon called "${str(raw.icon, 40) || "?"}".`,
        );
        break;
      }
      node = {
        ...base,
        type: "icon",
        icon: raw.icon,
        color: normalizeSceneColor(raw.color) ?? "brand.ink",
        strokeWidth: num(
          raw.strokeWidth,
          0.02,
          strokeWidth.min,
          strokeWidth.max,
        ),
      };
      break;
    }
    case "image": {
      const base = baseFields(raw, id, false);
      if (!base) break;
      const asset = str(raw.asset, 60);
      const allowed =
        (asset === "brand.logo" && budget.options.hasBrandLogo !== false) ||
        (asset.startsWith("image:") &&
          KEY.test(asset.slice(6)) &&
          (budget.options.imageKeys ?? []).includes(asset.slice(6)));
      if (!allowed) {
        budget.note(
          `Dropped "${id}": it pointed at a picture that was not delivered.`,
        );
        break;
      }
      if (budget.images >= SCENE_LIMITS.maxImages) {
        budget.note(
          `Dropped "${id}": a scene may hold ${SCENE_LIMITS.maxImages} pictures.`,
        );
        break;
      }
      budget.images += 1;
      node = {
        ...base,
        type: "image",
        asset,
        fit: pick(raw.fit, SCENE_IMAGE_FITS, "contain"),
        cornerRadius: radius(raw.cornerRadius),
      };
      break;
    }
    case "group": {
      const base = baseFields(raw, id, false);
      if (!base) break;
      if (depth >= SCENE_LIMITS.maxGroupDepth) {
        budget.note(
          `Dropped "${id}": groups nest ${SCENE_LIMITS.maxGroupDepth} deep at most.`,
        );
        break;
      }
      budget.nodes += 1;
      const children = Array.isArray(raw.children)
        ? raw.children
            .map((child, i) => validateNode(child, i, depth + 1, budget))
            .filter((child): child is SceneNode => child !== null)
        : [];
      if (children.length === 0) {
        budget.nodes -= 1;
        break;
      }
      return { ...base, type: "group", children };
    }
    default:
      budget.note(
        `Dropped "${id}": "${str(raw.type, 24) || "?"}" is not a node type.`,
      );
  }
  if (node) budget.nodes += 1;
  return node;
}

function validateAnimation(
  value: unknown,
  nodes: SceneNode[],
  duration: number,
  budget: Budget,
): SceneAnimation | null {
  const raw = record(value);
  if (!raw) return null;
  const property = pick(raw.property, SCENE_PROPERTIES, "" as SceneProperty);
  if (!property) return null;
  const target = typeof raw.node === "string" ? raw.node : "";
  const targets = target === "*" ? nodes : findTargets(nodes, target);
  if (targets.length === 0) return null;
  if (
    (property === "value" && targets.some((n) => n.type !== "number")) ||
    (property === "strokeEnd" && targets.some((n) => !strokes(n)))
  ) {
    budget.note(
      `Skipped a "${property}" animation on a node that has no ${property}.`,
    );
    return null;
  }
  if (!finite(raw.to)) return null;
  const start = num(raw.start, 0, 0, duration);
  const end = num(raw.end, duration, 0, duration);
  if (end <= start) return null;
  return {
    node: target,
    property,
    from: finite(raw.from) ? raw.from : undefined,
    to: raw.to,
    start,
    end,
    easing: pick(raw.easing, SCENE_EASINGS, "outCubic"),
    stagger: num(
      raw.stagger,
      0,
      SCENE_LIMITS.stagger.min,
      SCENE_LIMITS.stagger.max,
    ),
  };
}

function strokes(node: SceneNode): boolean {
  return (
    node.type === "path" ||
    node.type === "line" ||
    node.type === "rect" ||
    node.type === "ellipse" ||
    node.type === "icon"
  );
}

function findTargets(nodes: SceneNode[], id: string): SceneNode[] {
  for (const node of nodes) {
    if (node.id === id) return node.type === "group" ? node.children : [node];
    if (node.type === "group") {
      const found = findTargets(node.children, id);
      if (found.length > 0) return found;
    }
  }
  return [];
}

function animationCount(animation: SceneAnimation, nodes: SceneNode[]): number {
  if (animation.stagger <= 0) return 1;
  return animation.node === "*"
    ? nodes.length
    : Math.max(1, findTargets(nodes, animation.node).length);
}

export function validateScene(
  value: unknown,
  options: SceneValidationOptions = {},
): SceneValidation | null {
  const raw = record(value);
  if (!raw) return null;
  if (finite(raw.version) && raw.version > SCENE_LIMITS.version) return null;
  if (!finite(raw.duration)) return null;
  const budget = new Budget(options);
  const duration = clamp(
    raw.duration,
    SCENE_LIMITS.minDuration,
    SCENE_LIMITS.maxDuration,
  );

  const nodes = (Array.isArray(raw.nodes) ? raw.nodes : [])
    .map((node, index) => validateNode(node, index, 0, budget))
    .filter((node): node is SceneNode => node !== null);
  if (nodes.length === 0) return null;

  let animationBudget = SCENE_LIMITS.maxAnimations;
  const animations: SceneAnimation[] = [];
  for (const entry of Array.isArray(raw.animations) ? raw.animations : []) {
    const animation = validateAnimation(entry, nodes, duration, budget);
    if (!animation) continue;
    const cost = animationCount(animation, nodes);
    if (cost > animationBudget) {
      budget.note(
        `Left out animations past the limit of ${SCENE_LIMITS.maxAnimations}.`,
      );
      break;
    }
    animationBudget -= cost;
    animations.push(animation);
  }

  const background = record(raw.background);
  const fill = background ? normalizeSceneColor(background.fill) : null;
  const scene: OverlayScene = {
    version: 1,
    duration,
    poster: num(
      raw.poster,
      duration * SCENE_LIMITS.defaultPosterFraction,
      0,
      duration,
    ),
    nodes,
    animations,
    ...(fill
      ? {
          background: {
            fill,
            cornerRadius: num(background?.cornerRadius, 0, 0, 0.5),
            opacity: num(background?.opacity, 1, 0, 1),
          },
        }
      : {}),
  };
  return { scene, notes: budget.notes };
}
