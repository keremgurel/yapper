"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Menu, Plus, Sparkles, X } from "lucide-react";

import { trainingNavItems } from "@/data/training";
import { createNav } from "@/data/create-nav";

const EASE = [0.16, 1, 0.3, 1] as const;

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03, delayChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
};

interface Row {
  title: string;
  href: string;
}

const trainingRows: Row[] = trainingNavItems.map((i) => ({
  title: i.title,
  href: i.href,
}));
const createRows: Row[] = createNav.map((i) => ({
  title: i.title,
  href: i.href,
}));

function Section({
  icon,
  label,
  rows,
  onNavigate,
}: {
  icon: React.ReactNode;
  label: string;
  rows: Row[];
  onNavigate: () => void;
}) {
  return (
    <div>
      <p className="text-foreground/45 flex items-center gap-1.5 px-1 pt-1 pb-1.5 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
        {icon}
        {label}
      </p>
      {rows.map((row) => (
        <motion.div key={row.href + row.title} variants={itemVariants}>
          <Link
            href={row.href}
            onClick={onNavigate}
            className="group/row text-foreground/80 hover:text-foreground border-border/60 flex items-center justify-between border-b py-2.5 text-[15px] font-semibold no-underline transition-colors"
          >
            {row.title}
            <ArrowRight className="text-foreground/25 group-hover/row:text-foreground h-4 w-4 transition-all group-hover/row:translate-x-0.5" />
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * The mobile navbar IS the menu: the hamburger sits in the header's top row and
 * clicking it morphs the bar downward — a single panel that grows to reveal the
 * Training and Create links, coglyde-style.
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
            className="border-border bg-card absolute inset-x-0 top-full z-50 overflow-hidden border-b shadow-[0_28px_80px_rgba(15,23,42,0.18)]"
          >
            <motion.div
              variants={listVariants}
              initial="hidden"
              animate="show"
              className="no-scrollbar max-h-[70vh] space-y-4 overflow-y-auto px-4 pt-3 pb-5"
            >
              <Section
                icon={<Sparkles className="h-3 w-3 text-cyan-500" />}
                label="Training"
                rows={trainingRows}
                onNavigate={close}
              />
              <Section
                icon={<Plus className="h-3 w-3 text-cyan-500" />}
                label="Create"
                rows={createRows}
                onNavigate={close}
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
