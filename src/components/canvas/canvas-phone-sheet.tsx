"use client";

import SendToPhone from "@/components/workbench/send-to-phone";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * The teleprompter handoff, opened from the menu. The QR is minted only once
 * the sheet is open, which is what SendToPhone already guarantees.
 */
export default function CanvasPhoneSheet({
  open,
  onOpenChange,
  itemId,
  beforeOpen,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  beforeOpen: () => Promise<void>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Send to phone</SheetTitle>
          <SheetDescription>
            Opens this script in the teleprompter on your phone.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-8">
          {open && <SendToPhone itemId={itemId} beforeOpen={beforeOpen} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
