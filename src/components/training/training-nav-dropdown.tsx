"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  ChevronDown,
  HeartHandshake,
  Shuffle,
  Users,
  Volume2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  trainingNavDropdownItems,
  type TrainingNavItem,
} from "@/data/training";

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
      <span className="bg-muted text-foreground/75 group-hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="text-foreground block truncate text-[13px] font-bold">
          {item.title}
        </span>
        <span className="text-foreground/55 mt-0.5 line-clamp-1 block text-[11px] leading-4">
          {item.description}
        </span>
      </span>
    </Link>
  );
}

/** Free practice tools (SEO surface). Flat list, no groupings, these feed the
 * Creator workflow, they aren't the main app. */
export default function TrainingNavDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-foreground/80 hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[14px] font-semibold transition-colors"
        >
          <span>Training</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={12}
        style={{ boxShadow: "var(--sg-shadow-panel)" }}
        className="border-border bg-card no-scrollbar max-h-[min(80vh,640px)] w-[min(92vw,520px)] overflow-y-auto rounded-3xl p-3"
      >
        <p className="text-muted-foreground px-2.5 pt-1 pb-1.5 text-[11px] font-bold tracking-[0.1em] uppercase">
          Free practice tools
        </p>
        <div className="grid gap-0.5 sm:grid-cols-2">
          {trainingNavDropdownItems.map((item) => (
            <ResourceLink key={item.href} item={item} />
          ))}
        </div>
        <Button
          asChild
          variant="contrast"
          className="mt-2 w-full justify-between"
        >
          <Link href="/training" className="no-underline">
            Browse all practice tools
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
