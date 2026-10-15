"use client";

import {
  GlassContent,
  GlassScene,
  GlassSurface,
} from "@glass-sdk/liquid-glass";
import type { ComponentProps, ReactNode } from "react";
import { useTheme } from "next-themes";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import "@glass-sdk/liquid-glass/styles.css";

/** Bounded, neutral backdrop: the SDK only refracts content in its own scene. */
export function StudioGlassScene({
  children,
  className,
  ...props
}: ComponentProps<typeof GlassScene>) {
  const { resolvedTheme } = useTheme();
  // The server cannot know the saved theme, so the scene starts light like
  // the server's HTML and turns dark once hydrated. Reading the theme during
  // hydration left a dark-mode page with the light glass attribute.
  const dark = useHydrated() && resolvedTheme === "dark";
  return (
    <GlassScene
      material="regular"
      appearance={dark ? "dark" : "light"}
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
