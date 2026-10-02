"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Which header menu is open: a desktop panel (by label), the mobile sheet, or
 * nothing. Closes on outside pointer, and exposes a delayed close so a mouse
 * can travel from a trigger to its panel without the panel vanishing.
 */
export function useHeaderMenus() {
  const [panel, setPanel] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const root = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const close = () => {
    cancelClose();
    setPanel(null);
    setMobile(false);
  };

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setPanel(null);
        setMobile(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return {
    root,
    panel,
    mobile,
    close,
    cancelClose,
    openPanel: (label: string | null) => {
      cancelClose();
      setPanel(label);
      setMobile(false);
    },
    closePanelSoon: () => {
      cancelClose();
      timer.current = setTimeout(() => setPanel(null), 180);
    },
    toggleMobile: () => {
      setPanel(null);
      setMobile((open) => !open);
    },
  };
}
