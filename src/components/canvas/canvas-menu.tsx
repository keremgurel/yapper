"use client";

import { Copy, MoreHorizontal, Send, Smartphone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Everything you can do to the piece that is not writing it.
 *
 * One menu instead of a rail of buttons. Record is the primary action and
 * stays outside it; the rest are used once per piece at most, and a column of
 * six always-visible buttons made the page read as a form.
 */
export default function CanvasMenu({
  hasRecording,
  busy,
  onCopyScript,
  onSendToPhone,
  onEditOnMac,
  onCrossPost,
}: {
  hasRecording: boolean;
  busy: boolean;
  onCopyScript: () => void;
  onSendToPhone: () => void;
  onEditOnMac: () => void;
  onCrossPost: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="More actions"
          disabled={busy}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={onSendToPhone}>
          <Smartphone className="h-4 w-4" /> Send to phone
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCopyScript}>
          <Copy className="h-4 w-4" /> Copy script
        </DropdownMenuItem>
        {hasRecording && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onEditOnMac}>
              <Video className="h-4 w-4" /> Edit the recording
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onCrossPost}>
              <Send className="h-4 w-4" /> Cross-post
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
