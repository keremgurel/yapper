import { Chip } from "@/components/studio-ui";
import CopyButton from "@/components/training/feedback/copy-button";

/**
 * The coach's cleaned-up version of the answer: the headline artifact of the
 * rep. Carries the violet AI-provenance marker and a copy action.
 */
export default function PolishedPane({ text }: { text: string }) {
  if (!text.trim()) {
    return (
      <p className="text-muted-foreground text-[13px]">
        No cleaned-up version came back for this rep.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Chip tone="violet" variant="dot">
          Rewritten by the coach
        </Chip>
        <CopyButton text={text} label="Copy" />
      </div>
      <p className="text-foreground max-w-[68ch] text-[17px] leading-[1.75] whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}
