"use client";

const FIELD =
  "bg-muted text-foreground placeholder:text-muted-foreground w-full rounded-lg px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]";

/**
 * One title and one caption for one video, shared by every destination.
 *
 * This is the old behaviour and it is deliberately the fallback: the Poster
 * writes a caption per platform, and these fields exist only for the surfaces
 * that open the sheet straight from a list with nothing prepared.
 */
export default function SingleCopyFields({
  title,
  caption,
  disabled,
  onTitle,
  onCaption,
}: {
  title: string;
  caption: string;
  disabled: boolean;
  onTitle: (title: string) => void;
  onCaption: (caption: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="block">
        <span className="text-muted-foreground mb-1.5 block text-xs font-semibold">
          Title
        </span>
        <input
          value={title}
          onChange={(event) => onTitle(event.target.value)}
          maxLength={100}
          disabled={disabled}
          className={FIELD}
        />
      </label>
      <label className="block">
        <span className="text-muted-foreground mb-1.5 block text-xs font-semibold">
          Caption
        </span>
        <textarea
          value={caption}
          onChange={(event) => onCaption(event.target.value)}
          rows={4}
          maxLength={2200}
          disabled={disabled}
          placeholder="Used for Instagram and YouTube."
          className={`${FIELD} max-w-[68ch] resize-none leading-relaxed`}
        />
      </label>
    </div>
  );
}
