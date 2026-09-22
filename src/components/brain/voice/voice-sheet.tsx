"use client";

import VoiceSection from "@/components/brain/voice/voice-section";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** Picking videos and rebuilding the voice, one level below the canvas. */
export default function VoiceSheet({
  open,
  onOpenChange,
  onProfileChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileChanged: () => Promise<unknown>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>From your videos</SheetTitle>
          <SheetDescription>
            Pick videos where you talk to camera. Yapper listens once and writes
            how you sound and how your scripts are built into the fields on this
            page. Rebuild any time you add more.
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <VoiceSection onProfileChanged={onProfileChanged} embedded />
        </div>
      </SheetContent>
    </Sheet>
  );
}
