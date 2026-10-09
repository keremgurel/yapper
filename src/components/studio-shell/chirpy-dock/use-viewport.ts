"use client";

import { useEffect, useState } from "react";
import type { ChirpySize } from "@/components/studio-shell/chirpy-dock/chirpy-anchor";

/**
 * The visible window's size, kept current. Null until the first client frame.
 *
 * Read straight away and again a frame later: mid-resize, and while a
 * phone's browser bars or keyboard move, the size reported first can be the
 * old or an intermediate one, and a bird placed from it ends up off screen.
 */
export function useViewport(): ChirpySize | null {
  const [size, setSize] = useState<ChirpySize | null>(null);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      const width = window.visualViewport?.width ?? window.innerWidth;
      const height = window.visualViewport?.height ?? window.innerHeight;
      setSize((current) =>
        current?.width === width && current.height === height
          ? current
          : { width, height },
      );
    };
    const read = () => {
      measure();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    read();
    window.addEventListener("resize", read);
    window.visualViewport?.addEventListener("resize", read);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", read);
      window.visualViewport?.removeEventListener("resize", read);
    };
  }, []);
  return size;
}
