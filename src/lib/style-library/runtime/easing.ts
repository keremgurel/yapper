/** Easing curves as plain functions of 0..1, so motion does not depend on a render engine. */

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

/** A CSS-style cubic bezier through (0,0) and (1,1). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const curve = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  const slope = (a: number, b: number, t: number) =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t ** 2;

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Newton's method for the parameter at x, bisection if the slope flattens.
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const dx = curve(x1, x2, t) - x;
      const d = slope(x1, x2, t);
      if (Math.abs(dx) < 1e-6 || Math.abs(d) < 1e-6) break;
      t = clamp01(t - dx / d);
    }
    let low = 0;
    let high = 1;
    for (let i = 0; i < 24 && Math.abs(curve(x1, x2, t) - x) > 1e-6; i += 1) {
      if (curve(x1, x2, t) < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return curve(y1, y2, t);
  };
}

/** The one entrance curve of the Ep. 15 look: fast out, long settle. */
export const easeOutSettle = cubicBezier(0.22, 1, 0.36, 1);

export const easeInCubic = (t: number): number => clamp01(t) ** 3;
