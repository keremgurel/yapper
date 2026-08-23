"use client";

import { Textarea } from "@/components/ui/textarea";

/** Prose, written the way the creator would say it. Capped at a reading measure
 * rather than run to the width of the column, per the design language. */
export default function NoteEditor({
  title,
  body,
  onChange,
}: {
  title: string;
  body: string;
  onChange: (body: string) => void;
}) {
  return (
    <Textarea
      value={body}
      rows={5}
      aria-label={`${title} notes`}
      placeholder="Write it the way you would say it."
      onChange={(event) => onChange(event.target.value)}
      className="max-w-[68ch] text-[15px] leading-relaxed"
    />
  );
}
