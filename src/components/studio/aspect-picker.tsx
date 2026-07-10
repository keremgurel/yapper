"use client";

import { Ratio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStudio } from "@/components/studio/studio-context";
import { ASPECT_PRESETS, type AspectId } from "@/lib/studio/aspect";

/**
 * Picks the project's frame shape. This is the only place the export ratio is
 * decided — it used to be a side effect of whichever media happened to sit on
 * the bottom track, which meant deleting that track silently resized the video.
 */
export default function AspectPicker() {
  const { aspectId, setAspectId } = useStudio();
  const active = ASPECT_PRESETS.find((p) => p.id === aspectId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-foreground/70 shrink-0"
          title="Frame ratio for the preview and the export"
        >
          <Ratio className="h-3.5 w-3.5" />
          {active?.label ?? "Original"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Frame ratio</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={aspectId}
          onValueChange={(v) => setAspectId(v as AspectId)}
        >
          {ASPECT_PRESETS.map((p) => (
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
