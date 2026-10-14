import { Scissors } from "lucide-react";
import { charactersCut, fieldLength } from "@/lib/brain/field-fit";

/** Caution text on the shared yellow token, readable on both themes. */
export const FIT_CAUTION =
  "text-[color-mix(in_oklab,var(--sg-yellow-500)_48%,var(--sg-text))]";

/**
 * How much of one Essentials field the AI reads. Quiet while it fits; once
 * the text runs past the limit it says so, because the end is cut before any
 * prompt and the creator would otherwise never know.
 */
export default function FieldFit({
  text,
  limit,
}: {
  text: string;
  limit: number;
}) {
  const used = fieldLength(text);
  const cut = charactersCut(text, limit);
  return (
    <p
      className={`flex min-h-4 items-center gap-1.5 text-[11px] ${
        cut ? FIT_CAUTION : "text-muted-foreground"
      } ${used === 0 ? "invisible" : ""}`}
    >
      {cut ? (
        <>
          <Scissors aria-hidden className="size-3" />
          <span>The last {cut} characters aren’t read</span>
        </>
      ) : null}
      <span className="ml-auto font-mono tabular-nums">
        {used} / {limit}
      </span>
    </p>
  );
}
