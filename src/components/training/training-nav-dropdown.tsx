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

const groups: TrainingNavItem["group"][] = ["Practice now", "Guided drills"];

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

const statusDot: Record<TrainingNavItem["status"], string> = {
  "Free now": "bg-emerald-500",
  "Free guide": "bg-cyan-400",
};

function TrainingNavLink({ item }: { item: TrainingNavItem }) {
  const Icon = iconByTitle[item.title];

  return (
    <Link
      href={item.href}
      className="group hover:bg-muted flex min-w-0 items-start gap-3 rounded-2xl p-2.5 text-left no-underline transition-colors"
    >
      <span className="border-border bg-muted text-foreground/75 group-hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-colors">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-foreground truncate text-[13px] font-bold">
            {item.title}
          </span>
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[item.status]}`}
            title={item.status}
          />
        </span>
        <span className="text-foreground/55 mt-0.5 line-clamp-1 block text-[11.5px] leading-4">
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
          className="border-border bg-card text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold shadow-sm transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>Training</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={12}
        className="border-border bg-card max-h-[min(80vh,640px)] w-[min(92vw,560px)] overflow-y-auto rounded-3xl p-3 shadow-[0_28px_100px_rgba(15,23,42,0.22)]"
      >
        {groups.map((group, groupIndex) => {
          const items = trainingNavItems.filter((item) => item.group === group);
          return (
            <div key={group} className={groupIndex > 0 ? "mt-2" : undefined}>
              <p className="text-foreground/45 px-2.5 pt-1 pb-1.5 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
                {group}
              </p>
              <div className="grid gap-0.5 sm:grid-cols-2">
                {items.map((item) => (
                  <TrainingNavLink key={item.title} item={item} />
                ))}
              </div>
            </div>
          );
        })}

        <Link
          href="/training"
          className="bg-foreground text-background mt-2 flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-[13px] font-black no-underline transition-opacity hover:opacity-90"
        >
          Open the full training map
          <ArrowRight className="h-4 w-4" />
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
