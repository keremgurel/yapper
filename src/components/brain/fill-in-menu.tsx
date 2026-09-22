"use client";

import { ChevronDown, FileText, MessageCircle, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The one way in for everything that writes the Brain for you. Three sources,
 * one control, so the page itself stays a canvas the creator fills.
 */
export default function FillInMenu({
  onVideos,
  onDocument,
  onChirpy,
  videoCount,
}: {
  onVideos: () => void;
  onDocument: () => void;
  onChirpy: () => void;
  videoCount: number;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          Fill in from
          <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onSelect={onVideos}>
          <Video className="size-4" aria-hidden="true" />
          <span className="flex-1">Your videos</span>
          {videoCount > 0 && (
            <span className="text-muted-foreground text-xs">{videoCount}</span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDocument}>
          <FileText className="size-4" aria-hidden="true" />A document you wrote
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onChirpy}>
          <MessageCircle className="size-4" aria-hidden="true" />A conversation
          with Chirpy
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
