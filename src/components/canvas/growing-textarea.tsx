"use client";

import { useLayoutEffect, useRef, type ComponentProps } from "react";

/** A textarea that is as tall as its words, and no taller. WebKit has no
 * field-sizing yet, so the height is measured. */
export default function GrowingTextarea({
  value,
  minHeight = 0,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { value: string; minHeight?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.max(element.scrollHeight, minHeight)}px`;
  }, [value, minHeight]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      className={`resize-none bg-transparent outline-none ${className}`}
      {...props}
    />
  );
}
