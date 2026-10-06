"use client";

import { Clapperboard, Upload, ArrowRight } from "lucide-react";
import PlatformIcon from "@/components/publish/platform-icon";
import { PLATFORMS } from "@/lib/publish/platforms";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";
import type { PosterSource } from "./use-source-videos";

export default function SourceOptions({
  onChoose,
  onUpload,
  connected,
}: {
  onChoose: (source: PosterSource) => void;
  onUpload: () => void;
  connected: PublishPlatform[];
}) {
  const row =
    "group flex min-h-24 w-full items-center gap-4 border-b border-border py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";
  return (
    <section
      aria-label="Choose a video source"
      className="mx-auto w-full max-w-3xl py-6"
    >
      <h2 className="mb-2 text-xl font-semibold">
        What would you like to post?
      </h2>
      <p className="text-muted-foreground mb-6 text-sm">
        Start with your latest edit, a finished file, or a video from a
        connected channel.
      </p>
      <button className={row} onClick={() => onChoose("yapper")}>
        <Clapperboard
          aria-hidden
          className="text-muted-foreground size-6 shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Made in Yapper</span>
          <span className="text-muted-foreground mt-1 block text-sm">
            The latest finished version of each edited project.
          </span>
        </span>
        <ArrowRight aria-hidden className="size-4 shrink-0" />
      </button>
      <div className="border-border flex items-center gap-3 border-b">
        <button className={`${row} border-0`} onClick={onUpload}>
          <Upload
            aria-hidden
            className="text-muted-foreground size-6 shrink-0"
          />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Upload a video</span>
            <span className="text-muted-foreground mt-1 block text-sm">
              Choose a finished file from your computer.
            </span>
          </span>
        </button>
        <button
          onClick={() => onChoose("uploads")}
          className="focus-visible:outline-ring shrink-0 rounded-md px-2 py-3 text-sm font-medium underline underline-offset-4 focus-visible:outline-2"
        >
          View uploads
        </button>
      </div>
      <div className="py-5">
        <h3 className="font-semibold">From a platform</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose one of your published videos to send elsewhere.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {publishPlatforms.map((platform) => (
            <button
              key={platform}
              onClick={() => onChoose(platform)}
              className="border-border hover:bg-muted focus-visible:outline-ring flex min-h-16 items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm font-medium focus-visible:outline-2"
            >
              <PlatformIcon platform={platform} className="size-4 shrink-0" />
              <span>
                {PLATFORMS[platform].label}
                <span className="text-muted-foreground block text-xs font-normal">
                  {connected.includes(platform)
                    ? "Connected"
                    : "Connect account"}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
