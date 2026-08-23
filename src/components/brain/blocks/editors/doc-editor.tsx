"use client";

import { CHUNK_THRESHOLD } from "@/lib/brain/context/chunk";
import { Textarea } from "@/components/ui/textarea";

/**
 * A long document, kept whole.
 *
 * The line under it is not decoration. A creator who pastes a research summary
 * needs to know it will not be sent whole, or they will wonder why the model
 * quoted one paragraph and ignored another; saying that it is read in pieces,
 * and which pieces, is the difference between a feature and a mystery.
 */
export default function DocEditor({
  title,
  body,
  onChange,
}: {
  title: string;
  body: string;
  onChange: (body: string) => void;
}) {
  const chunked = body.length > CHUNK_THRESHOLD;

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        rows={12}
        aria-label={`${title} document`}
        placeholder="Paste the document. All of it is kept."
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[68ch] font-mono text-[13px] leading-relaxed"
      />
      <p className="text-muted-foreground text-xs">
        {chunked
          ? "Kept whole, read in pieces. Only the parts about what you are writing go into a prompt."
          : "Short enough to be read in one piece."}
      </p>
    </div>
  );
}
