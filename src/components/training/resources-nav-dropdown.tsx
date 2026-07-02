"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  ChevronDown,
  HeartHandshake,
  Library,
  Shuffle,
  Users,
  Volume2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resourcesNavItems, type TrainingNavItem } from "@/data/training";

const iconByTitle: Record<string, ComponentType<{ className?: string }>> = {
  "Random topic generator": Shuffle,
  "Read aloud": Volume2,
  "Explain after reading": BookOpen,
  "Interview prep": BriefcaseBusiness,
  "Conflict handling": HeartHandshake,
  "Dating/social practice": Users,
};

function ResourceLink({ item }: { item: TrainingNavItem }) {
  const Icon = iconByTitle[item.title] ?? BookOpen;
  return (
    <Link
      href={item.href}
      className="group hover:bg-muted flex min-w-0 items-start gap-3 rounded-2xl p-2.5 text-left no-underline transition-colors"
    >
      <span className="border-border bg-muted text-foreground/75 group-hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-colors">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="text-foreground block truncate text-[13px] font-bold">
          {item.title}
        </span>
        <span className="text-foreground/55 mt-0.5 line-clamp-1 block text-[11.5px] leading-4">
          {item.description}
        </span>
      </span>
    </Link>
  );
}

/** Free practice tools (SEO surface). Flat list, no groupings, these feed the
 * Creator workflow, they aren't the main app. */
export default function ResourcesNavDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="border-border bg-card text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold shadow-sm transition-colors"
        >
          <Library className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>Resources</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={12}
        style={{ boxShadow: "var(--sg-shadow-panel)" }}
        className="border-border bg-card no-scrollbar max-h-[min(80vh,640px)] w-[min(92vw,520px)] overflow-y-auto rounded-3xl p-3"
      >
        <p className="text-foreground/45 px-2.5 pt-1 pb-1.5 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
          Free practice tools
        </p>
        <div className="grid gap-0.5 sm:grid-cols-2">
          {resourcesNavItems.map((item) => (
            <ResourceLink key={item.href} item={item} />
          ))}
        </div>
        <Link
          href="/training"
          className="bg-foreground text-background mt-2 flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-[13px] font-black no-underline transition-opacity hover:opacity-90"
        >
          Browse all practice tools
          <ArrowRight className="h-4 w-4" />
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
