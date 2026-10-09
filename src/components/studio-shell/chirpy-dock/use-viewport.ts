"use client";

import { useEffect, useState } from "react";
import type { ChirpySize } from "@/components/studio-shell/chirpy-dock/chirpy-anchor";

/** The window's size, kept current. Null until the first client frame. */
export function useViewport(): ChirpySize | null {
  const [size, setSize] = useState<ChirpySize | null>(null);
  useEffect(() => {
    const read = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return size;
}
