import { Check } from "lucide-react";
import PlatformIcon from "@/components/publish/platform-icon";
import type { PublishPlatform } from "@/lib/db/schema";

/** A small, true-to-the-app slice of each Studio step. Sample text only. */

function Line({ w, strong = false }: { w: string; strong?: boolean }) {
  return (
    <span
      className={`block h-2 rounded-full ${strong ? "bg-foreground/25" : "bg-foreground/10"}`}
      style={{ width: w }}
    />
  );
}

export function IdeaBody() {
  return (
    <div className="space-y-3">
      <p className="text-foreground text-sm font-semibold">
        Why your first video should be bad
      </p>
      <p className="text-muted-foreground text-[13px] leading-relaxed">
        Nobody remembers it. Post it, learn what the second one needs.
      </p>
      <div className="flex gap-1.5">
        <span className="bg-muted rounded-full px-2 py-0.5 text-[11px] font-semibold">
          Short-form
        </span>
        <span className="bg-muted rounded-full px-2 py-0.5 text-[11px] font-semibold">
          Drafting
        </span>
      </div>
    </div>
  );
}

export function ScriptBody() {
  return (
    <div className="space-y-2.5">
      <p className="text-muted-foreground text-[11px] font-semibold">Hook</p>
      <p className="text-foreground text-sm font-semibold">
        My first video got 12 views. Here’s why that was the point.
      </p>
      <p className="text-muted-foreground pt-1 text-[11px] font-semibold">
        Body
      </p>
      <Line w="92%" />
      <Line w="78%" />
      <Line w="64%" />
    </div>
  );
}

export function RecordBody() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span className="size-2 rounded-full bg-[#ff4e45]" />
        <span className="tabular-nums">00:42</span>
        <span className="text-muted-foreground">Teleprompter · 130 wpm</span>
      </div>
      <p className="text-muted-foreground text-[13px] leading-relaxed">
        My first video got 12 views.
      </p>
      <p className="text-foreground text-base leading-snug font-semibold">
        Here’s why that was the point.
      </p>
    </div>
  );
}

export function EditBody() {
  return (
    <div className="space-y-2 text-[13px] leading-relaxed">
      <p className="text-foreground">So I posted it anyway.</p>
      <p className="text-muted-foreground line-through decoration-[#ff4e45]/70">
        Um, wait, let me say that again.
      </p>
      <p className="text-foreground">
        So I posted it anyway, and nothing broke.
      </p>
      <p className="text-muted-foreground pt-1 text-[11px] font-semibold">
        2 retakes and 14 pauses cut
      </p>
    </div>
  );
}

const POSTS: { platform: PublishPlatform; name: string }[] = [
  { platform: "youtube", name: "YouTube Shorts" },
  { platform: "tiktok", name: "TikTok" },
  { platform: "instagram", name: "Instagram Reels" },
];

export function PublishBody() {
  return (
    <ul className="space-y-2">
      {POSTS.map(({ platform, name }) => (
        <li
          key={platform}
          className="bg-muted/60 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold"
        >
          <PlatformIcon platform={platform} branded className="size-3.5" />
          <span className="flex-1">{name}</span>
          <Check className="size-3.5 text-[#22a06b]" aria-hidden />
        </li>
      ))}
    </ul>
  );
}
