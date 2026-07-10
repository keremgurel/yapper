"use client";

import { Columns2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LAYOUT_PRESETS, type LayoutId } from "@/lib/studio/layout";

/** Picks where the preview sits: above the timeline, or beside the panels. */
export default function LayoutPicker({
  layout,
  onChange,
}: {
  layout: LayoutId;
  onChange: (id: LayoutId) => void;
}) {
  const active = LAYOUT_PRESETS.find((p) => p.id === layout);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-foreground/70 shrink-0"
          title="Where the preview sits"
        >
          <Columns2 className="h-3.5 w-3.5" />
          {active?.label ?? "Classic"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Layout</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={layout}
          onValueChange={(v) => onChange(v as LayoutId)}
        >
          {LAYOUT_PRESETS.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id}>
              <span className="flex w-full items-center justify-between gap-3">
                <span className="font-medium">{p.label}</span>
                <span className="text-muted-foreground text-xs">{p.hint}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
