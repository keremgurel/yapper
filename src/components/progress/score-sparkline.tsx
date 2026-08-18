"use client";

import { useRef, useState } from "react";

export interface SparklinePoint {
  /** Preformatted date label, e.g. "Aug 12". */
  label: string;
  /** Overall score, 0-100. */
  score: number;
}

// A fixed drawing space; the svg scales to its container. The y-axis is
// pinned to 0-100 so the slope means real change, not range-normalized
// position: a flat line of 70s draws flat, a climb from 40 draws as a climb.
const W = 640;
const H = 200;
const PAD = { top: 12, right: 14, bottom: 26, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function x(index: number, count: number): number {
  if (count <= 1) return PAD.left + PLOT_W / 2;
  return PAD.left + (index / (count - 1)) * PLOT_W;
}

function y(score: number): number {
  return PAD.top + (1 - score / 100) * PLOT_H;
}

/**
 * A hand-authored SVG line of overall score per coached rep, evenly spaced by
 * rep (this is a practice log, not a time series with meaningful gaps). The
 * line takes the informational cyan, matching the score ring and dimension
 * meters; grid, ticks and labels stay in ink tokens. Hovering reads out
 * the nearest rep; the same data lives in the sessions table for keyboard and
 * screen-reader access.
 */
export default function ScoreSparkline({
  points,
}: {
  points: SparklinePoint[];
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const count = points.length;
  const first = points[0];
  const last = points[count - 1];
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i, count)},${y(p.score)}`)
    .join(" ");

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || count === 0) return;
    const chartX = ((event.clientX - rect.left) / rect.width) * W;
    const ratio = Math.min(1, Math.max(0, (chartX - PAD.left) / PLOT_W));
    setHovered(Math.round(ratio * (count - 1)));
  };

  const active = hovered === null ? null : points[hovered];

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={
          count === 1
            ? `Overall score for one coached rep: ${first.score} on ${first.label}.`
            : `Overall score across ${count} coached reps, from ${first.score} on ${first.label} to ${last.score} on ${last.label}. Scale 0 to 100.`
        }
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHovered(null)}
      >
        {/* Recessive grid at the fixed scale's anchors. */}
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize={11}
              className="fill-muted-foreground"
            >
              {tick}
            </text>
          </g>
        ))}

        {/* Oldest and latest ends of the series, labeled. */}
        {first && (
          <text
            x={PAD.left}
            y={H - 8}
            textAnchor="start"
            fontSize={11}
            className="fill-muted-foreground"
          >
            {first.label}
          </text>
        )}
        {last && count > 1 && (
          <text
            x={W - PAD.right}
            y={H - 8}
            textAnchor="end"
            fontSize={11}
            className="fill-muted-foreground"
          >
            {last.label}
          </text>
        )}

        {count > 1 && (
          <path
            d={path}
            fill="none"
            stroke="var(--sg-cyan-500)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {last && (
          <circle
            cx={x(count - 1, count)}
            cy={y(last.score)}
            r={3.5}
            fill="var(--sg-cyan-500)"
            stroke="var(--card)"
            strokeWidth={2}
          />
        )}

        {hovered !== null && active && (
          <g>
            <line
              x1={x(hovered, count)}
              x2={x(hovered, count)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <circle
              cx={x(hovered, count)}
              cy={y(active.score)}
              r={3.5}
              fill="var(--sg-cyan-500)"
              stroke="var(--card)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {hovered !== null && active && (
        <div
          className="bg-popover border-border text-foreground pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border px-2 py-1 text-xs whitespace-nowrap"
          style={{
            left: `${(x(hovered, count) / W) * 100}%`,
          }}
        >
          {active.label}
          <span className="ml-1.5 font-mono font-semibold tabular-nums">
            {active.score}
          </span>
        </div>
      )}
    </div>
  );
}
