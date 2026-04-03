"use client";

import { motion, AnimatePresence } from "framer-motion";

const STROKE = 2.2;
const EASE = [0.22, 1, 0.36, 1] as const;

/* ─── Mic with animated strike-through ─── */
export function AnimatedMicIcon({
  muted,
  size = 16,
}: {
  muted: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
      <motion.line
        x1="2"
        y1="2"
        x2="22"
        y2="22"
        strokeDasharray="28.28"
        initial={false}
        animate={{
          strokeDashoffset: muted ? 0 : 28.28,
          opacity: muted ? 1 : 0,
        }}
        transition={{ duration: 0.35, ease: EASE }}
      />
    </svg>
  );
}

/* ─── Camera with animated strike-through ─── */
export function AnimatedCameraIcon({
  off,
  size = 16,
}: {
  off: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      <motion.line
        x1="1"
        y1="1"
        x2="23"
        y2="23"
        strokeDasharray="31.11"
        initial={false}
        animate={{
          strokeDashoffset: off ? 0 : 31.11,
          opacity: off ? 1 : 0,
        }}
        transition={{ duration: 0.35, ease: EASE }}
      />
    </svg>
  );
}

/* ─── Pause / Play toggle ─── */
export function AnimatedPausePlayIcon({
  paused,
  size = 18,
}: {
  paused: boolean;
  size?: number;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.svg
        key={paused ? "play" : "pause"}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ opacity: 0, scale: 0.5, rotate: -30 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        exit={{ opacity: 0, scale: 0.5, rotate: 30 }}
        transition={{ duration: 0.25, ease: EASE }}
      >
        {paused ? (
          <polygon points="5,3 19,12 5,21" />
        ) : (
          <>
            <line x1="8" y1="4" x2="8" y2="20" />
            <line x1="16" y1="4" x2="16" y2="20" />
          </>
        )}
      </motion.svg>
    </AnimatePresence>
  );
}

/* ─── Stop / Finish (square morphing in) ─── */
export function AnimatedStopIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <motion.rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: EASE }}
      />
    </svg>
  );
}

/* ─── Reset (rotating arrow) ─── */
export function AnimatedResetIcon({ size = 18 }: { size?: number }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      whileTap={{ rotate: -360 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </motion.svg>
  );
}
