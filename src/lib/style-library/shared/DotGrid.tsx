import type { CSSProperties } from "react";

export interface DotGridProps {
  /** Colour under the dots. */
  base: string;
  /** Distance between dots, in design pixels. */
  spacing: number;
  /** Dot radius, in design pixels. */
  dot: number;
  /** How white the dots are, 0 to 1. */
  opacity: number;
  /** Width of the soft edge around each dot, in design pixels. */
  edge?: number;
}

/** A flat colour with a fine grid of dots, as a CSS background. */
export const dotGridBackground = ({
  base,
  spacing,
  dot,
  opacity,
  edge = 0.3,
}: DotGridProps): CSSProperties => ({
  backgroundColor: base,
  backgroundImage: `radial-gradient(rgba(255,255,255,${opacity}) ${dot}px, transparent ${dot + edge}px)`,
  backgroundSize: `${spacing}px ${spacing}px`,
  backgroundPosition: `${spacing / 2}px ${spacing / 2}px`,
});

/** The dotted backdrop filling its parent. */
export function DotGrid(props: DotGridProps) {
  return (
    <div
      style={{ position: "absolute", inset: 0, ...dotGridBackground(props) }}
    />
  );
}
