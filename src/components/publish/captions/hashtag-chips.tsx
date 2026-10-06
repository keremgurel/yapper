"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Chip } from "@/components/studio-ui";
import {
  addHashtags,
  removeHashtag,
} from "@/components/publish/captions/caption-draft";

/**
 * Hashtags as removable chips rather than a text field.
 *
 * The engine stores them as an array and `renderCaption` joins them, so a free
 * text field would mean parsing the creator's spacing back into that array on
 * every keystroke. Chips keep the stored shape and the shown shape the same
 * thing, and the only local state is the tag being typed.
 */
export default function HashtagChips({
  tags,
  min,
  max,
  disabled,
  onChange,
}: {
  tags: string[];
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (tags: string[]) => void;
}) {
  const [typing, setTyping] = useState("");

  const commit = () => {
    if (!typing.trim()) return;
    onChange(addHashtags(tags, typing));
    setTyping("");
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <Chip
            key={tag}
            tone="neutral"
            endAdornment={
              <button
                type="button"
                aria-label={`Remove #${tag}`}
                disabled={disabled}
                onClick={() => onChange(removeHashtag(tags, tag))}
                className="text-muted-foreground hover:text-foreground -mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
              >
                <X aria-hidden className="h-3 w-3" />
              </button>
            }
          >
            {`#${tag}`}
          </Chip>
        ))}
        <input
          value={typing}
          disabled={disabled}
          aria-label="Add a hashtag"
          placeholder="Add hashtag"
          onChange={(event) => setTyping(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            // Space and comma are how people type tag lists; both commit rather
            // than landing inside a tag that cannot contain them.
            if (
              event.key === "Enter" ||
              event.key === " " ||
              event.key === ","
            ) {
              event.preventDefault();
              commit();
            }
            if (event.key === "Backspace" && !typing && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          className="text-foreground placeholder:text-muted-foreground focus-visible:ring-ring h-8 w-28 min-w-0 rounded-md bg-transparent px-1 text-[13px] outline-none focus-visible:ring-2"
        />
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        {tags.length} {tags.length === 1 ? "hashtag" : "hashtags"}. {min} to{" "}
        {max} suits this platform.
      </p>
    </div>
  );
}
