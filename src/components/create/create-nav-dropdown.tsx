"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CreateIcon from "@/components/create/create-icon";
import { createNav } from "@/data/create-nav";

export default function CreateNavDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-foreground/80 hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[14px] font-semibold transition-colors"
        >
          <span>Create</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        style={{ boxShadow: "var(--sg-shadow-panel)" }}
        className="border-border bg-card w-[min(92vw,340px)] overflow-hidden rounded-3xl p-2"
      >
        {createNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group hover:bg-muted flex min-w-0 items-start gap-3 rounded-2xl p-2.5 text-left no-underline transition-colors"
          >
            <span className="border-border bg-muted text-foreground/75 group-hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-colors">
              <CreateIcon icon={item.icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="text-foreground block text-[13px] font-bold">
                {item.title}
              </span>
              <span className="text-foreground/55 mt-0.5 block text-[11.5px] leading-4">
                {item.description}
              </span>
            </span>
          </Link>
        ))}

        <Link
          href="/create"
          className="bg-foreground text-background mt-1 flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-[13px] font-black no-underline transition-opacity hover:opacity-90"
        >
          See how it fits together
          <ArrowRight className="h-4 w-4" />
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
