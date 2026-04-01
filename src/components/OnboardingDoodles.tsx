"use client";

import { useState, useEffect } from "react";

const ONBOARDING_KEY = "yapper-onboarded";

export default function OnboardingDoodles() {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(ONBOARDING_KEY)) return;
    const id = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(id);
  }, []);

  const dismiss = () => {
    setFadingOut(true);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(ONBOARDING_KEY, "1");
    }, 500);
  };

  if (!visible) return null;

  const stroke = "#fbbf24";
  const arrowFilter = "drop-shadow(0 2px 4px rgba(0,0,0,0.5))";

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-50 hidden transition-opacity duration-500 md:block ${
        fadingOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Click catcher */}
      <div className="pointer-events-auto absolute inset-0" onClick={dismiss} />

      {/* ── Camera/Mic ── top-right, arrow curves down-left into container */}
      <div
        className="animate-fade-in absolute -top-14 right-6"
        style={{ animationDelay: "0.2s", animationFillMode: "both" }}
      >
        <div className="flex items-end gap-1">
          <span className="rounded-lg bg-white/95 px-3 py-2 text-[13px] leading-tight font-semibold text-slate-800 shadow-lg dark:bg-zinc-800/95 dark:text-zinc-100">
            Turn on your camera
            <br />
            &amp; mic if you want!
          </span>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path
              d="M8 4 C12 10, 18 16, 24 22 C28 26, 32 32, 34 36"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              className="animate-draw"
              style={{ filter: arrowFilter }}
            />
            <path
              d="M28 34 L35 38 L36 30"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{ filter: arrowFilter }}
            />
          </svg>
        </div>
      </div>

      {/* ── Topic ── top-center, arrow points down into topic card */}
      <div
        className="animate-fade-in absolute -top-14 left-[38%] -translate-x-1/2"
        style={{ animationDelay: "0.5s", animationFillMode: "both" }}
      >
        <div className="flex items-end gap-1">
          <span className="rounded-lg bg-white/95 px-3 py-2 text-[13px] font-semibold text-slate-800 shadow-lg dark:bg-zinc-800/95 dark:text-zinc-100">
            Double-tap to write your own topic
          </span>
          <svg width="30" height="36" viewBox="0 0 30 36" fill="none">
            <path
              d="M15 4 C17 10, 13 16, 15 22 C16 27, 15 30, 15 33"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              className="animate-draw"
              style={{ filter: arrowFilter }}
            />
            <path
              d="M9 28 L15 35 L21 28"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{ filter: arrowFilter }}
            />
          </svg>
        </div>
      </div>

      {/* ── Lever ── left side, arrow hugs bottom-left corner of container */}
      <div
        className="animate-fade-in absolute bottom-[22%] -left-2"
        style={{ animationDelay: "0.7s", animationFillMode: "both" }}
      >
        <div className="flex items-center gap-1">
          <span className="rounded-lg bg-white/95 px-3 py-2 text-[13px] leading-tight font-semibold text-slate-800 shadow-lg dark:bg-zinc-800/95 dark:text-zinc-100">
            Pull the lever
            <br />
            for a random topic
          </span>
          <svg width="50" height="30" viewBox="0 0 50 30" fill="none">
            <path
              d="M5 15 C12 14, 18 16, 26 15 C34 14, 38 15, 44 15"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              className="animate-draw"
              style={{ filter: arrowFilter }}
            />
            <path
              d="M38 9 L46 15 L38 21"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{ filter: arrowFilter }}
            />
          </svg>
        </div>
      </div>

      {/* ── Knob ── right side, arrow points left into container */}
      <div
        className="animate-fade-in absolute -right-2 bottom-[22%]"
        style={{ animationDelay: "0.9s", animationFillMode: "both" }}
      >
        <div className="flex items-center gap-1">
          <svg width="50" height="30" viewBox="0 0 50 30" fill="none">
            <path
              d="M45 15 C38 16, 32 14, 24 15 C16 16, 12 15, 6 15"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              className="animate-draw"
              style={{ filter: arrowFilter }}
            />
            <path
              d="M12 9 L4 15 L12 21"
              stroke={stroke}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{ filter: arrowFilter }}
            />
          </svg>
          <span className="rounded-lg bg-white/95 px-3 py-2 text-[13px] leading-tight font-semibold text-slate-800 shadow-lg dark:bg-zinc-800/95 dark:text-zinc-100">
            Drag the knob
            <br />
            to set your timer
          </span>
        </div>
      </div>

      {/* Dismiss hint */}
      <div
        className="animate-fade-in pointer-events-auto absolute -bottom-10 left-1/2 -translate-x-1/2"
        style={{ animationDelay: "1.2s", animationFillMode: "both" }}
      >
        <button
          onClick={dismiss}
          className="cursor-pointer rounded-full bg-white/95 px-5 py-2 text-[12px] font-semibold text-slate-600 shadow-lg transition-colors hover:bg-white dark:bg-zinc-800/95 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Click anywhere to dismiss
        </button>
      </div>
    </div>
  );
}
