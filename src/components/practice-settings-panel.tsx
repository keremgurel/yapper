"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MeshGradient } from "@paper-design/shaders-react";

interface PracticeSettingsPanelProps {
  open: boolean;
  videoFormat: "portrait" | "landscape";
  includePromptOverlay: boolean;
  includeTimerOverlay: boolean;
  isCompactDevice: boolean;
  onFormatChange: (format: "portrait" | "landscape") => void;
  onPromptOverlayToggle: (value: boolean) => void;
  onTimerOverlayToggle: (value: boolean) => void;
}

function ToggleRow({
  label,
  description,
  active,
  onToggle,
}: {
  label: string;
  description: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-[24px] border border-white/12 bg-black/18 px-4 py-4 text-left backdrop-blur-xl transition-transform duration-300 hover:scale-[1.01] hover:bg-black/24"
    >
      <div className="max-w-[80%]">
        <p className="font-display text-[17px] font-semibold text-white">
          {label}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-white/55">
          {description}
        </p>
      </div>
      <div
        className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${
          active ? "bg-blue-500" : "bg-white/12"
        }`}
      >
        <div
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.3)] transition-all duration-300 ${
            active ? "left-6" : "left-1"
          }`}
        />
      </div>
    </button>
  );
}

export default function PracticeSettingsPanel({
  open,
  videoFormat,
  includePromptOverlay,
  includeTimerOverlay,
  isCompactDevice,
  onFormatChange,
  onPromptOverlayToggle,
  onTimerOverlayToggle,
}: PracticeSettingsPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 overflow-hidden rounded-[inherit]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="absolute inset-0"
            initial={{
              clipPath: "circle(18px at calc(100% - 2.125rem) 2.125rem)",
            }}
            animate={{
              clipPath: "circle(150% at calc(100% - 2.125rem) 2.125rem)",
            }}
            exit={{
              clipPath: "circle(18px at calc(100% - 2.125rem) 2.125rem)",
            }}
            transition={{ duration: 0.84, ease: [0.22, 1, 0.36, 1] }}
          >
            <MeshGradient
              className="absolute inset-0 h-full w-full"
              colors={["#000000", "#06b6d4", "#0891b2", "#164e63", "#f97316"]}
              speed={0.3}
              distortion={0.4}
              swirl={0.3}
            />
          </motion.div>

          <motion.div
            className="relative flex h-full flex-col px-5 py-5 md:px-7 md:py-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{
              duration: 0.48,
              delay: 0.2,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="flex items-start justify-between gap-4 pr-14">
              <div className="max-w-[520px]">
                <p className="text-[11px] font-semibold tracking-[0.24em] text-blue-300/80 uppercase">
                  Camera Settings
                </p>
                <h3 className="font-display mt-2 text-[28px] leading-[0.95] font-semibold tracking-[-0.03em] text-white md:text-[34px]">
                  Shape the recording
                  <br />
                  before you start talking.
                </h3>
                <p className="mt-3 max-w-[480px] text-[14px] leading-relaxed text-white/58 md:text-[15px]">
                  Pick the frame that matches where the clip will live. Phones
                  and tablets start in portrait. Desktop starts in landscape.
                </p>
              </div>
            </div>

            <div className="mt-8 grid flex-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[28px] border border-white/12 bg-black/18 p-4 backdrop-blur-xl md:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-white/40 uppercase">
                      Aspect Ratio
                    </p>
                    <p className="mt-2 text-[14px] leading-relaxed text-white/58">
                      Use landscape for a wider stage. Use portrait for Reels,
                      TikTok, and vertical speaking practice.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/12 bg-black/16 px-3 py-1 text-[11px] font-medium text-white/62 backdrop-blur-xl">
                    {isCompactDevice
                      ? "Mobile default: 9:16"
                      : "Desktop default: 16:9"}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => onFormatChange("landscape")}
                    className={`group rounded-[24px] border p-4 text-left transition-all duration-300 ${
                      videoFormat === "landscape"
                        ? "border-blue-400/60 bg-blue-500/18 shadow-[0_18px_45px_rgba(59,130,246,0.16)]"
                        : "border-white/12 bg-black/14 hover:border-white/22 hover:bg-black/22"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-display text-[19px] font-semibold text-white">
                        Horizontal
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
                          videoFormat === "landscape"
                            ? "bg-blue-400/20 text-blue-200"
                            : "bg-white/8 text-white/45"
                        }`}
                      >
                        16:9
                      </span>
                    </div>
                    <div className="mt-4 rounded-[18px] border border-white/10 bg-black/32 p-3 backdrop-blur-xl">
                      <div className="aspect-[16/9] rounded-[14px] border border-white/10 bg-[radial-gradient(circle_at_65%_45%,rgba(59,130,246,0.22),transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))]" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onFormatChange("portrait")}
                    className={`group rounded-[24px] border p-4 text-left transition-all duration-300 ${
                      videoFormat === "portrait"
                        ? "border-blue-400/60 bg-blue-500/18 shadow-[0_18px_45px_rgba(59,130,246,0.16)]"
                        : "border-white/12 bg-black/14 hover:border-white/22 hover:bg-black/22"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-display text-[19px] font-semibold text-white">
                        Vertical
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
                          videoFormat === "portrait"
                            ? "bg-blue-400/20 text-blue-200"
                            : "bg-white/8 text-white/45"
                        }`}
                      >
                        9:16
                      </span>
                    </div>
                    <div className="mt-4 rounded-[18px] border border-white/10 bg-black/32 p-3 backdrop-blur-xl">
                      <div className="mx-auto aspect-[9/16] h-[140px] rounded-[14px] border border-white/10 bg-[radial-gradient(circle_at_65%_45%,rgba(251,146,60,0.22),transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))]" />
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-[28px] border border-white/12 bg-black/18 p-4 backdrop-blur-xl md:p-5">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.2em] text-white/40 uppercase">
                    Export Overlays
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/58">
                    These settings control what gets burned into the downloaded
                    recording. You can expand this panel later with more camera
                    controls.
                  </p>
                </div>

                <ToggleRow
                  label="Prompt overlay"
                  description="Keep the topic visible on the saved clip."
                  active={includePromptOverlay}
                  onToggle={() => onPromptOverlayToggle(!includePromptOverlay)}
                />

                <ToggleRow
                  label="Timer overlay"
                  description="Show the countdown in the exported video."
                  active={includeTimerOverlay}
                  onToggle={() => onTimerOverlayToggle(!includeTimerOverlay)}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
