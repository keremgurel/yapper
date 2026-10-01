"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const Material = dynamic(() => import("metal-fx").then((m) => m.MetalFx), {
  ssr: false,
});

export default function MetalAction({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const reduced = useReducedMotion();
  // The original accessible button stays present before the shader loads and
  // in no-JS/WebGL contexts. Only the noninteractive material is client-rendered.
  return (
    <span className="metal-action">
      <span className="metal-action-material" aria-hidden="true">
        <Material
          preset="chromatic"
          variant="button"
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          paused={!!reduced}
          disableGlow={!!reduced}
        >
          <span className="metal-action-fill" />
        </Material>
      </span>
      <span className="metal-action-control">{children}</span>
    </span>
  );
}
