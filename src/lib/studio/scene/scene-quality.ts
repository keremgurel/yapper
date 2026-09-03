import type { OverlayScene, SceneNode, SceneProperty } from "./scene-types";
import { SCENE_LIMITS } from "./scene-limits";

type Box = { x: number; y: number; width: number; height: number };
export interface QualityContext {
  widthPx: number;
  heightPx: number;
  frameHeightPx: number;
  requireMotion?: boolean;
}

/** Conservative layout preflight. Native Core Text checks actual glyph metrics
 * before insertion too. This pass gives the designer actionable repair feedback
 * instead of silently mutating its typography. No composition templates. */
export function sceneQualityIssues(
  scene: OverlayScene,
  context: QualityContext,
): string[] {
  const issues = new Set<string>();
  const segments = new Map<string, typeof scene.animations>();
  const all: SceneNode[] = [];
  function collect(nodes: SceneNode[]) {
    for (const n of nodes) {
      all.push(n);
      if (n.type === "group") collect(n.children);
    }
  }
  collect(scene.nodes);
  for (const a of scene.animations) {
    const node = all.find((n) => n.id === a.node);
    const targets =
      a.node === "*"
        ? scene.nodes
        : node?.type === "group"
          ? node.children
          : node
            ? [node]
            : [];
    targets.forEach((n, i) =>
      segments.set(n.id, [
        ...(segments.get(n.id) ?? []),
        {
          ...a,
          start: a.start + i * a.stagger,
          end: a.end + i * a.stagger,
        },
      ]),
    );
  }
  function value(
    n: SceneNode,
    property: SceneProperty,
    t: number,
    resting: number,
  ) {
    let current = resting;
    const list = (segments.get(n.id) ?? [])
      .filter((a) => a.property === property)
      .sort((a, b) => a.start - b.start);
    for (const [i, a] of list.entries()) {
      const from = a.from ?? current;
      if (t < a.start) return i === 0 ? from : current;
      if (t >= a.end) {
        current = a.to;
        continue;
      }
      // Endpoints and holds are exact; interpolation is only used to detect
      // mid-motion collisions, with a small tolerance for transitions.
      const p = (t - a.start) / (a.end - a.start);
      return from + (a.to - from) * p;
    }
    return current;
  }
  if (context.requireMotion && !scene.animations.some((a) => a.to !== a.from))
    issues.add(
      "The request is animated, but the scene has no changing animation.",
    );
  for (const n of all) {
    if (n.type !== "text" && n.type !== "number") continue;
    if (
      n.size * context.heightPx <
      SCENE_LIMITS.minLegibleFrameFraction * context.frameHeightPx - 0.1
    )
      issues.add(
        `${n.id}: font size ${n.size.toFixed(3)} is below the minimum; recompose with readable text, do not just enlarge it in place.`,
      );
    if (
      (segments.get(n.id) ?? []).some(
        (a) => a.property === "width" || a.property === "height",
      )
    )
      issues.add(`${n.id}: animate scale/position, not text width or height.`);
    if (
      n.type === "number" &&
      n.from !== n.to &&
      !(segments.get(n.id) ?? []).some((a) => a.property === "value")
    )
      issues.add(
        `${n.id}: a changing counter needs a value animation from 0 to 1.`,
      );
  }
  const times = new Set([
    scene.poster,
    scene.duration * 0.4,
    scene.duration * 0.7,
  ]);
  scene.animations.forEach((a) => {
    times.add(a.start);
    times.add(a.end);
  });
  for (let t = 0.25; t < scene.duration; t += 0.25) times.add(t);
  for (const t of times) {
    const textBoxes: (Box & { id: string })[] = [];
    function walk(nodes: SceneNode[], parent: Box, inheritedOpacity: number) {
      for (const n of nodes) {
        const opacity = inheritedOpacity * value(n, "opacity", t, n.opacity);
        if (opacity < 0.85) continue; // cross-fades intentionally overlap briefly
        const box = {
          x: parent.x + value(n, "x", t, n.x) * parent.width,
          y: parent.y + value(n, "y", t, n.y) * parent.height,
          width: n.width * parent.width,
          height: n.height * parent.height,
        };
        if (n.type === "group") {
          walk(n.children, box, opacity);
          continue;
        }
        if (n.type !== "text" && n.type !== "number") continue;
        const texts =
          n.type === "text"
            ? [n.uppercase ? n.text.toUpperCase() : n.text]
            : [n.from, n.to].map(
                (v) =>
                  `${n.prefix}${new Intl.NumberFormat("en-US", { maximumFractionDigits: n.format === "decimal1" ? 1 : 0 }).format(v)}${n.suffix}${n.format === "percent" ? "%" : ""}`,
              );
        const font = n.size * context.heightPx;
        let lines = 1;
        for (const text of texts) {
          // Deliberately slightly generous; exact native metrics are the final gate.
          const width = (s: string) =>
            [...s].reduce(
              (sum, c) =>
                sum +
                (/\s/.test(c)
                  ? 0.3
                  : /[ilI1.,:!|]/.test(c)
                    ? 0.3
                    : /[MW@%]/.test(c)
                      ? 0.9
                      : 0.6) *
                  font,
              0,
            );
          if (n.type === "number" && width(text) > box.width + 1)
            issues.add(
              `${n.id}: the counter's longest value cannot fit on one line; widen it or simplify the layout.`,
            );
          let count = 1,
            used = 0;
          for (const word of text.split(/\s+/)) {
            const w = width(word);
            if (w > box.width + 1)
              issues.add(`${n.id}: the word "${word}" is wider than its box.`);
            if (used > 0 && used + w + font * 0.3 > box.width) {
              count++;
              used = w;
            } else used += w + (used ? font * 0.3 : 0);
          }
          lines = Math.max(lines, count);
        }
        const height = lines * font * Math.max(1.2, n.lineHeight);
        if (height > box.height + 2)
          issues.add(
            `${n.id}: needs ${(height / context.heightPx).toFixed(3)} scene-height for text, but its box is only ${(box.height / context.heightPx).toFixed(3)}. Increase height/recompose.`,
          );
        const ink = { ...box, height, id: n.id };
        if (
          ink.x < -1 ||
          ink.y < -1 ||
          ink.x + ink.width > context.widthPx + 1 ||
          ink.y + ink.height > context.heightPx + 1
        )
          issues.add(`${n.id}: text extends outside the scene.`);
        textBoxes.push(ink);
      }
    }
    walk(
      scene.nodes,
      { x: 0, y: 0, width: context.widthPx, height: context.heightPx },
      1,
    );
    for (let i = 0; i < textBoxes.length; i++)
      for (let j = i + 1; j < textBoxes.length; j++) {
        const a = textBoxes[i],
          b = textBoxes[j];
        const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (w > 2 && h > 2)
          issues.add(
            `${a.id} and ${b.id}: visible text boxes overlap. Separate them spatially or in time.`,
          );
      }
  }
  return [...issues].slice(0, 16);
}
