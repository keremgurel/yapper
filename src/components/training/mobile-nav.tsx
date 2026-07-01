"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Camera,
  Flame,
  HeartHandshake,
  Menu,
  Mic,
  Sparkles,
  Users,
  Volume2,
  X,
} from "lucide-react";

import { trainingNavItems } from "@/data/training";
import { createNav } from "@/data/create-nav";
import CreateIcon from "@/components/create/create-icon";

const EASE = [0.16, 1, 0.3, 1] as const;

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.025, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.26, ease: EASE } },
};

type Icon = ComponentType<{ className?: string }>;

const trainingIcon: Record<string, Icon> = {
  "Random topic generator": Sparkles,
  "Freestyle speaking": Mic,
  "Fluency drills": Flame,
  "Explain after reading": BookOpen,
  "Read aloud": Volume2,
  "Interview prep": BriefcaseBusiness,
  "Dating/social practice": Users,
  "Conflict handling": HeartHandshake,
  "Creator camera drills": Camera,
};

function Row({
  href,
  title,
  icon,
  onNavigate,
}: {
  href: string;
  title: string;
  icon: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <motion.div variants={itemVariants}>
      <Link
        href={href}
        onClick={onNavigate}
        className="group hover:bg-muted flex items-center gap-3 rounded-2xl p-2.5 no-underline transition-colors"
      >
        <span className="border-border bg-muted text-foreground/75 group-hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-colors">
          {icon}
        </span>
        <span className="text-foreground flex-1 text-[14px] font-bold">
          {title}
        </span>
        <ArrowRight className="text-foreground/25 group-hover:text-foreground h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5" />
      </Link>
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-foreground/45 px-2.5 pt-2 pb-1 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
      {children}
    </p>
  );
}

/**
 * The mobile navbar IS the menu: the hamburger sits in the header's top row and
 * clicking it morphs the bar downward — a single rounded panel that grows to
 * reveal the Training and Create links, coglyde-style.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="border-border bg-card text-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {open ? (
          <motion.button
            aria-hidden
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 z-40 cursor-default bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
        ) : null}
      </AnimatePresence>

      {/* Morphing panel — grows out of the header's bottom edge. */}
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="border-border bg-card absolute inset-x-0 top-full z-50 overflow-hidden rounded-b-3xl border-b shadow-[0_28px_80px_rgba(15,23,42,0.18)]"
          >
            <motion.div
              variants={listVariants}
              initial="hidden"
              animate="show"
              className="no-scrollbar max-h-[72vh] space-y-0.5 overflow-y-auto p-3"
            >
              <SectionLabel>Training</SectionLabel>
              {trainingNavItems.map((item) => (
                <Row
                  key={`t-${item.href}-${item.title}`}
                  href={item.href}
                  title={item.title}
                  icon={(() => {
                    const I = trainingIcon[item.title] ?? Sparkles;
                    return <I className="h-4 w-4" />;
                  })()}
                  onNavigate={close}
                />
              ))}

              <div className="border-border/60 my-2 border-t" />

              <SectionLabel>Create</SectionLabel>
              {createNav.map((item) => (
                <Row
                  key={`c-${item.href}`}
                  href={item.href}
                  title={item.title}
                  icon={<CreateIcon icon={item.icon} className="h-4 w-4" />}
                  onNavigate={close}
                />
              ))}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
