"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Camera,
  ChevronDown,
  Flame,
  HeartHandshake,
  MessageCircle,
  Mic,
  Shuffle,
  Sparkles,
  Users,
  Volume2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trainingNavItems, type TrainingNavItem } from "@/data/training";

const groups: TrainingNavItem["group"][] = [
  "Practice now",
  "Guided drills",
  "Coming programs",
];

const iconByTitle: Record<string, ComponentType<{ className?: string }>> = {
  "Random topic generator": Shuffle,
  "Freestyle speaking": Mic,
  "Fluency drills": Flame,
  "Explain after reading": BookOpen,
  "Read aloud": Volume2,
  "Interview prep": BriefcaseBusiness,
  "Dating/social practice": Users,
  "Conflict handling": HeartHandshake,
  "Creator camera drills": Camera,
};

const statusStyles: Record<TrainingNavItem["status"], string> = {
  "Free now":
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  "Free guide":
    "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
  Coming:
    "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-white/52",
};

function TrainingNavLink({ item }: { item: TrainingNavItem }) {
  const Icon = iconByTitle[item.title];

  return (
    <Link
      href={item.href}
      className="group flex min-w-0 gap-3 rounded-2xl p-3 text-left no-underline transition-colors hover:bg-slate-950/[0.045] dark:hover:bg-white/[0.065]"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-900/8 bg-white/72 text-slate-800 shadow-sm dark:border-white/10 dark:bg-white/[0.075] dark:text-white">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-slate-950 dark:text-white">
            {item.title}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${statusStyles[item.status]}`}
          >
            {item.status}
          </span>
        </span>
        <span className="mt-1 block text-[12px] leading-5 text-slate-600 dark:text-white/56">
          {item.description}
        </span>
      </span>
    </Link>
  );
}

export default function TrainingNavDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/8 bg-white/55 px-3 py-2 text-[13px] font-bold text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-white/10 dark:bg-white/[0.055] dark:text-white/74 dark:hover:bg-white/[0.09]"
        >
          <Sparkles className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-300" />
          <span className="hidden sm:inline">Training</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={12}
        className="w-[calc(100vw-1.5rem)] max-w-[960px] overflow-hidden rounded-[1.5rem] border-slate-900/10 bg-[#f8fafc]/96 p-0 shadow-[0_28px_100px_rgba(15,23,42,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#12141b]/96"
      >
        <div className="grid gap-0 lg:grid-cols-[1fr_310px]">
          <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <div key={group} className="min-w-0">
                <p className="px-3 pt-2 pb-1 font-mono text-[10px] font-black tracking-[0.16em] text-slate-500 uppercase dark:text-white/36">
                  {group}
                </p>
                <div className="space-y-1">
                  {trainingNavItems
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <TrainingNavLink key={item.title} item={item} />
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="relative overflow-hidden border-t border-slate-900/10 bg-slate-950 p-5 text-white lg:border-t-0 lg:border-l dark:border-white/10">
            <div className="pointer-events-none absolute inset-0 opacity-45">
              <div className="absolute -top-16 -right-12 h-40 w-40 rounded-full bg-cyan-300 blur-3xl" />
              <div className="absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-orange-500 blur-3xl" />
            </div>
            <div className="relative flex h-full min-h-[260px] flex-col justify-between">
              <div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                  <MessageCircle className="h-5 w-5 text-cyan-200" />
                </span>
                <h2 className="font-display mt-6 text-3xl leading-none font-black">
                  Train every kind of yap.
                </h2>
                <p className="mt-4 text-sm leading-6 text-white/64">
                  Start with free reps now: random topics, freestyle speaking,
                  and a fluency warmup guide. More guided programs come later.
                </p>
              </div>
              <Link
                href="/training"
                className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-slate-950 no-underline transition-transform hover:-translate-y-0.5"
              >
                Open training map
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
