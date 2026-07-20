"use client";

import { useState } from "react";
import { Camera, Hash, Sparkles, Zap } from "lucide-react";
import AutomationToggle from "./automation-toggle";

/** One destination the Instagram source can fan out to. */
const DESTINATIONS = [
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube Shorts" },
] as const;

type DestinationId = (typeof DESTINATIONS)[number]["id"];

/**
 * The Automations setup: configure the repurpose flow where posting to
 * Instagram fans a video out to your other platforms, with hashtag stripping
 * and caption reformatting. This is the setup surface; the background runner
 * that watches for new posts and fires the cross-post is the next piece, so a
 * banner is honest about that rather than pretending it is already live.
 */
export default function AutomationsView() {
  const [enabled, setEnabled] = useState(false);
  const [destinations, setDestinations] = useState<DestinationId[]>([
    "tiktok",
    "youtube",
  ]);
  const [stripHashtags, setStripHashtags] = useState(true);
  const [reformatForYouTube, setReformatForYouTube] = useState(true);

  const toggleDestination = (id: DestinationId) =>
    setDestinations((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-[color:var(--sg-accent)]/30 bg-[color:var(--sg-accent)]/5 px-4 py-3 text-sm">
        <p className="text-foreground font-bold">Early access</p>
        <p className="text-muted-foreground mt-0.5">
          Set your automation up here now. The background runner that watches
          for new Instagram posts and fires the cross-post is rolling out, and
          it will use exactly what you configure below, no need to set it up
          twice.
        </p>
      </div>

      <div className="border-border bg-card rounded-2xl border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--sg-accent)]/10 text-[color:var(--sg-accent)]">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-foreground text-base font-black tracking-tight">
                Repurpose my Instagram posts
              </h2>
              <p className="text-muted-foreground mt-0.5 text-sm">
                When you post a video to Instagram, Yapper pulls it in and
                cross-posts it to the platforms you pick.
              </p>
            </div>
          </div>
          <AutomationToggle
            checked={enabled}
            onChange={setEnabled}
            label="Enable this automation"
          />
        </div>

        <div
          className={`mt-5 flex flex-col gap-5 border-t border-dashed pt-5 transition-opacity ${
            enabled ? "opacity-100" : "pointer-events-none opacity-40"
          }`}
        >
          <div>
            <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase">
              <Camera className="h-3.5 w-3.5" /> Source
            </p>
            <div className="border-border text-foreground inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold">
              <Camera className="h-4 w-4" /> Instagram
            </div>
            <p className="text-muted-foreground mt-1.5 text-xs">
              Instagram is the source because it is the one platform that lets
              us pull your posted video back out to repurpose it.
            </p>
          </div>

          <div>
            <p className="text-muted-foreground mb-2 text-xs font-bold tracking-wide uppercase">
              Cross-post to
            </p>
            <div className="flex flex-wrap gap-2">
              {DESTINATIONS.map((d) => {
                const on = destinations.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDestination(d.id)}
                    aria-pressed={on}
                    className={`rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                      on
                        ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)]/10 text-[color:var(--sg-accent)]"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
              Options
            </p>
            <label className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm">
                <Hash className="text-muted-foreground h-4 w-4" />
                <span>
                  <span className="text-foreground font-bold">
                    Strip hashtags
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    Remove the #tags from the caption on the other platforms.
                  </span>
                </span>
              </span>
              <AutomationToggle
                checked={stripHashtags}
                onChange={setStripHashtags}
                label="Strip hashtags"
                disabled={!enabled}
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-sm">
                <Sparkles className="text-muted-foreground h-4 w-4" />
                <span>
                  <span className="text-foreground font-bold">
                    Reformat for YouTube
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    Turn the caption into a YouTube title and description.
                  </span>
                </span>
              </span>
              <AutomationToggle
                checked={reformatForYouTube}
                onChange={setReformatForYouTube}
                label="Reformat caption for YouTube"
                disabled={!enabled}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
