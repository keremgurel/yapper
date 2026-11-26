"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Whether a horizontal list can scroll each way, and a page step for each. */
export function useRailScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ back: false, forward: false });

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    setEdges({
      back: node.scrollLeft > 4,
      forward: node.scrollLeft + node.clientWidth < node.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure]);

  const step = useCallback((direction: 1 | -1) => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    node.scrollBy({
      left: direction * node.clientWidth * 0.8,
      behavior: reduce ? "auto" : "smooth",
    });
  }, []);

  return { ref, edges, step };
}
