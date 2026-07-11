"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

/** Full-screen scrim for the setup flow. The user opens this deliberately (from
 * the "Set up your studio" prompt), so it IS dismissible — close button, Escape,
 * and backdrop click all let them out to finish later. Locks body scroll while
 * open. */
export default function OnboardingOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Set up your studio"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="sg-panel relative w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close setup"
          className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-md transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}
