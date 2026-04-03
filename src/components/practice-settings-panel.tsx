"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MeshGradient } from "@paper-design/shaders-react";
import { Camera, Clapperboard, Download } from "lucide-react";

interface PracticeSettingsPanelProps {
  open: boolean;
  videoFormat: "portrait" | "landscape";
  isCompactDevice: boolean;
  onFormatChange: (format: "portrait" | "landscape") => void;
}

function InstructionRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/14 bg-white/8 text-white/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.24)] backdrop-blur-xl">
        {icon}
      </div>
      <div className="space-y-1.5">
        <p className="font-display text-[18px] leading-none font-semibold text-white">
          {title}
        </p>
        <p className="max-w-[460px] text-[14px] leading-relaxed text-white/58">
          {body}
        </p>
      </div>
    </div>
  );
}

function FormatButton({
  active,
  label,
  ratio,
  summary,
  previewClassName,
  onClick,
}: {
  active: boolean;
  label: string;
  ratio: string;
  summary: string;
  previewClassName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-[22px] border px-4 py-3.5 text-left transition-all duration-300 md:gap-4 md:rounded-[28px] md:px-5 md:py-5 ${
        active
          ? "border-white/36 bg-[linear-gradient(135deg,rgba(255,255,255,0.28),rgba(255,255,255,0.12))] shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_28px_60px_rgba(15,23,42,0.18)] backdrop-blur-3xl"
          : "border-white/14 bg-[linear-gradient(180deg,rgba(8,12,22,0.46),rgba(8,12,22,0.2))] backdrop-blur-xl hover:border-white/24 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.06))]"
      }`}
    >
      <div
        className={`absolute top-4 right-4 h-2.5 w-2.5 rounded-full transition-all duration-300 ${
          active
            ? "bg-white shadow-[0_0_14px_rgba(255,255,255,0.9)]"
            : "bg-white/18"
        }`}
      />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-3">
          <p
            className={`font-display text-[20px] leading-none font-semibold transition-colors duration-300 md:text-[24px] ${
              active ? "text-white" : "text-white/78"
            }`}
          >
            {label}
          </p>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase transition-all duration-300 ${
              active
                ? "border border-white/20 bg-white/14 text-white/88"
                : "border border-white/10 bg-white/6 text-white/46"
            }`}
          >
            {ratio}
          </span>
        </div>
        <p
          className={`max-w-[260px] text-[14px] leading-relaxed transition-colors duration-300 ${
            active ? "text-white/72" : "text-white/46"
          }`}
        >
          {summary}
        </p>
      </div>

      <div
        className={`flex shrink-0 items-center justify-center rounded-[22px] border p-3 transition-all duration-300 ${
          active
            ? "border-white/20 bg-white/12 backdrop-blur-2xl"
            : "border-white/10 bg-black/12 backdrop-blur-xl"
        }`}
      >
        <div className={previewClassName} />
      </div>
    </button>
  );
}

export default function PracticeSettingsPanel({
  open,
  videoFormat,
  isCompactDevice,
  onFormatChange,
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
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,20,0.34),rgba(6,10,20,0.22))] backdrop-blur-[34px]" />
          </motion.div>

          <motion.div
            className="relative h-full overflow-y-auto overscroll-contain px-5 pt-16 pb-6 md:flex md:items-center md:overflow-y-visible md:px-10 md:pt-8 md:pb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{
              duration: 0.46,
              delay: 0.18,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="mx-auto grid w-full max-w-[1120px] items-start gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(320px,380px)] md:gap-14">
              <div className="space-y-5 md:space-y-8">
                <div className="space-y-3 md:space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-3 py-1.5 text-[10px] font-semibold tracking-[0.2em] text-white/76 uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.24)] backdrop-blur-xl">
                    <span className="h-2 w-2 rounded-full bg-blue-300 shadow-[0_0_10px_rgba(147,197,253,0.7)]" />
                    Recording setup
                  </div>

                  <div className="space-y-2 md:space-y-4">
                    <h3 className="font-display max-w-[620px] text-[26px] leading-[0.92] font-semibold tracking-[-0.06em] text-white md:text-[64px]">
                      Set the frame,
                      <br />
                      then start talking.
                    </h3>
                    <p className="max-w-[560px] text-[14px] leading-relaxed text-white/64 md:text-[18px]">
                      Choose the shape that matches where the clip will live.
                      Turn on camera or mic only if you want a replay later. At
                      the end, you can watch it back and download it if it is
                      worth keeping.
                    </p>
                  </div>
                </div>

                <div className="hidden gap-6 md:grid md:max-w-[640px]">
                  <InstructionRow
                    icon={<Camera className="h-4.5 w-4.5" strokeWidth={2.2} />}
                    title="Recording is optional"
                    body="If camera or mic is on, the round ends with a replay and a download option. If not, it stays a clean practice session."
                  />
                  <InstructionRow
                    icon={
                      <Clapperboard className="h-4.5 w-4.5" strokeWidth={2.2} />
                    }
                    title="The stage stays uncluttered"
                    body="This only changes the recording shape. The practice layout stays familiar while you talk."
                  />
                  <InstructionRow
                    icon={
                      <Download className="h-4.5 w-4.5" strokeWidth={2.2} />
                    }
                    title="Review first, save second"
                    body="Watch the take back after the timer ends, then decide whether it deserves a download."
                  />
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                <div className="space-y-2 md:space-y-3">
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-white/42 uppercase">
                    Frame
                  </p>
                  <h4 className="font-display text-[24px] leading-none font-semibold tracking-[-0.05em] text-white md:text-[36px]">
                    Pick the take format.
                  </h4>
                  <p className="text-[13px] leading-relaxed text-white/54 md:text-[15px]">
                    {isCompactDevice
                      ? "Phones and tablets usually feel best in vertical."
                      : "Desktop usually feels best in horizontal."}
                  </p>
                </div>

                <div className="space-y-2.5 md:space-y-3">
                  <FormatButton
                    active={videoFormat === "landscape"}
                    label="Horizontal"
                    ratio="16:9"
                    summary="Best for desktop playback, YouTube style framing, and wider camera composition."
                    onClick={() => onFormatChange("landscape")}
                    previewClassName="h-12 w-20 rounded-[14px] border border-white/12 bg-[radial-gradient(circle_at_60%_50%,rgba(96,165,250,0.3),transparent_28%),linear-gradient(145deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04))]"
                  />
                  <FormatButton
                    active={videoFormat === "portrait"}
                    label="Vertical"
                    ratio="9:16"
                    summary="Best for Reels, TikTok, Shorts, and phone-first speaking clips."
                    onClick={() => onFormatChange("portrait")}
                    previewClassName="h-[72px] w-10 rounded-[14px] border border-white/12 bg-[radial-gradient(circle_at_50%_46%,rgba(251,146,60,0.3),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.14),rgba(255,255,255,0.04))]"
                  />
                </div>

                <p className="hidden pt-2 text-[13px] leading-relaxed text-white/49 md:block">
                  Tip: horizontal is the default on desktop. Vertical is the
                  better choice when the final clip is meant to live on a phone
                  screen.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
