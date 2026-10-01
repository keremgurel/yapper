"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type { ComponentProps, ReactNode } from "react";
import type { VoiceBeam as Beam } from "voice-glow";

const VoiceBeam = dynamic(() => import("voice-glow").then((m) => m.VoiceBeam), {
  ssr: false,
  loading: () => null,
});

/** Decorative only: recording and permission handling remain with the caller. */
export default function VoiceSurface({
  children,
  stream,
  processing = false,
  active = false,
  level,
  type = "default",
  className = "",
  theme,
}: {
  children: ReactNode;
  stream?: MediaStream | null;
  processing?: boolean;
  active?: boolean;
  level?: number | (() => number);
  type?: ComponentProps<typeof Beam>["type"];
  className?: string;
  theme?: "dark" | "light";
}) {
  const { resolvedTheme } = useTheme();
  return (
    <div className={`voice-surface ${className}`}>
      {children}
      {active && (
        <div className="voice-surface-effect" aria-hidden="true">
          <VoiceBeam
            stream={stream}
            level={level}
            processing={processing}
            type={type}
            theme={theme ?? (resolvedTheme === "dark" ? "dark" : "light")}
            style={{ width: "100%", height: "100%" }}
          >
            <div
              style={{ width: "100%", height: "100%", borderRadius: "inherit" }}
            />
          </VoiceBeam>
        </div>
      )}
    </div>
  );
}
