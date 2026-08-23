"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

/**
 * The box you can put anything in.
 *
 * No format, no picker, no "choose a type" step. A keyword export, a list of
 * content gaps, a competitor teardown, the transcript of the video that worked:
 * whatever lands here is read and laid out before the creator does anything
 * else, and if the reading was wrong they can change the kind afterwards.
 */
export default function PastePane({
  onText,
}: {
  onText: (text: string) => void;
}) {
  const [text, setText] = useState("");

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        rows={10}
        aria-label="Paste anything"
        placeholder="Paste a list, a spreadsheet, a research doc, a transcript. Anything."
        onChange={(event) => {
          setText(event.target.value);
          onText(event.target.value);
        }}
        className="font-mono text-[13px]"
      />
      <p className="text-muted-foreground text-xs">
        Read in your browser, so nothing is uploaded until you save it.
      </p>
    </div>
  );
}
