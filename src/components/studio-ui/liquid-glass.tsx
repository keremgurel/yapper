"use client";

import {
  GlassContent,
  GlassScene,
  GlassSurface,
} from "@glass-sdk/liquid-glass";
import type { ComponentProps, ReactNode } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import "@glass-sdk/liquid-glass/styles.css";

/** Bounded, neutral backdrop: the SDK only refracts content in its own scene. */
export function StudioGlassScene({
  children,
  className,
  ...props
}: ComponentProps<typeof GlassScene>) {
  const { resolvedTheme } = useTheme();
  return (
    <GlassScene
      material="regular"
      appearance={resolvedTheme === "dark" ? "dark" : "light"}
      motion="none"
      className={cn("studio-glass", className)}
      {...props}
    >
      <GlassContent
        aria-hidden="true"
        className="bg-muted pointer-events-none rounded-[inherit]"
      />
      {children}
    </GlassScene>
  );
}

export function StudioGlassSurface({
  children,
  className,
  sceneClassName,
  radius = 20,
  ...props
}: ComponentProps<typeof GlassSurface> & {
  children: ReactNode;
  sceneClassName?: string;
}) {
  return (
    <StudioGlassScene className={sceneClassName}>
      <GlassSurface
        radius={radius}
        className={cn("studio-glass-surface", className)}
        {...props}
      >
        {children}
      </GlassSurface>
    </StudioGlassScene>
  );
}
