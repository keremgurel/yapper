"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import type { MaskFn } from "metal-fx";

const Material = dynamic(() => import("metal-fx").then((m) => m.MetalFx), {
  ssr: false,
});

const pillMask: MaskFn = (context, width, height) => {
  context.beginPath();
  context.roundRect(0, 0, width, height, height / 2);
  context.fill();
};

/** MetalBadge's chromatic material and white core, with intrinsic label width
 * and MetalFx's pause control. The upstream badge fixes its width to “New” and
 * doesn't expose paused. Material baseline: https://libraries.dev/metal. */
export default function MetalStatusBadge({ children }: { children: string }) {
  const [hovered, setHovered] = useState(false);
  const reducedMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();
  return (
    <span
      className="metal-status-badge"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onPointerCancel={() => setHovered(false)}
    >
      <span className="metal-status-material" aria-hidden="true">
        <Material
          preset="chromatic"
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          strength={0.8}
          shaderScale={1.6}
          mask={pillMask}
          glowMode="ring"
          borderRadius={999}
          paused={!hovered || reducedMotion !== false}
          style={{ background: "#ffffff", borderRadius: 999, width: "100%" }}
        >
          <span className="metal-status-surface">
            <span className="metal-status-core" />
            <span className="metal-status-rim" />
          </span>
        </Material>
      </span>
      <span className="metal-status-label">{children}</span>
    </span>
  );
}
