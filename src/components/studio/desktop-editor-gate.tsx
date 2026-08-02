"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AppWindowMac,
  ArrowRight,
  Check,
  Download,
  ExternalLink,
  Film,
  Gauge,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const DESKTOP_DOWNLOAD_URL =
  "https://github.com/keremgurel/yapper/releases/download/v0.9.19/Yapper-Studio-macOS.zip";
const DESKTOP_OPEN_URL = "yapper-studio://open/editor";

const BENEFITS = [
  {
    icon: Gauge,
    title: "Native-speed editing",
    body: "Scrub, cut, zoom, and play one continuous timeline without uploading the source video.",
  },
  {
    icon: Sparkles,
    title: "The same AI workflow",
    body: "Transcribe and run 1-Click Edit, then move back to Poster or Calendar on the web.",
  },
  {
    icon: ShieldCheck,
    title: "Your media stays local",
    body: "The editor works directly with files on your Mac. Account and publishing data stay synced.",
  },
];

/** Browser handoff for the one Studio surface that requires the native app. */
export default function DesktopEditorGate() {
  const [opening, setOpening] = useState(false);

  function openDesktopEditor() {
    setOpening(true);
    window.location.assign(DESKTOP_OPEN_URL);
    window.setTimeout(() => setOpening(false), 1800);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 py-2 sm:py-6">
      <section className="relative overflow-hidden rounded-2xl border bg-[color:var(--card)] px-6 py-8 shadow-sm sm:px-10 sm:py-10 lg:grid lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 85% at 0% 0%, color-mix(in srgb, var(--sg-accent) 16%, transparent), transparent 70%)",
          }}
        />
        <div className="relative z-10 max-w-xl">
          <div className="bg-background/80 mb-5 flex h-11 w-11 items-center justify-center rounded-xl border text-[color:var(--sg-accent)] shadow-sm backdrop-blur">
            <Film className="h-5 w-5" />
          </div>
          <p className="text-sm font-bold text-[color:var(--sg-accent)]">
            Native editor
          </p>
          <h1 className="font-display mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Edit locally. Keep the rest of Studio on the web.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-lg text-base leading-relaxed">
            Video editing opens in Yapper Studio for Mac for the fastest
            playback and export. Idea Bank, Content Library, Poster, Calendar,
            analytics, and connections all stay available here in your browser.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button type="button" size="lg" onClick={openDesktopEditor}>
              <AppWindowMac className="h-4 w-4" />
              {opening ? "Opening Yapper Studio…" : "Open desktop editor"}
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={DESKTOP_DOWNLOAD_URL}>
                <Download className="h-4 w-4" />
                Download for Mac
              </a>
            </Button>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            macOS 14 or newer · Apple Silicon · free download
          </p>
        </div>

        <div className="relative z-10 mt-10 lg:mt-0">
          <div className="overflow-hidden rounded-xl border bg-[#08090a] shadow-2xl shadow-black/20">
            <div className="flex h-10 items-center gap-2 border-b border-white/10 px-4">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-[11px] font-semibold text-white/55">
                Yapper Studio · Editor
              </span>
            </div>
            <div className="grid min-h-64 grid-cols-[0.72fr_1fr]">
              <div className="border-r border-white/10 p-5">
                <div className="h-2 w-24 rounded-full bg-white/16" />
                <div className="mt-5 space-y-2.5">
                  {[72, 93, 84, 62, 88, 54].map((width, index) => (
                    <div
                      key={`${width}-${index}`}
                      className="h-2 rounded-full"
                      style={{
                        width: `${width}%`,
                        background:
                          index === 2
                            ? "color-mix(in srgb, var(--sg-accent) 74%, white)"
                            : "rgba(255,255,255,.12)",
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-col p-4">
                <div className="grid flex-1 place-items-center rounded-lg bg-black">
                  <div className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/10 text-white">
                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                  </div>
                </div>
                <div className="mt-4 h-16 rounded-md border border-white/10 bg-white/[0.03] p-2">
                  <div className="flex h-full items-end gap-1 overflow-hidden rounded bg-[color:color-mix(in_srgb,var(--sg-accent)_16%,transparent)] px-2">
                    {[
                      18, 32, 25, 43, 22, 38, 50, 30, 46, 21, 36, 28, 44, 25,
                      34, 48, 24, 39, 29, 45,
                    ].map((height, index) => (
                      <span
                        key={`${height}-${index}`}
                        className="min-w-0 flex-1 rounded-t-sm bg-[color:var(--sg-accent)] opacity-80"
                        style={{ height }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {BENEFITS.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="gap-0 p-5">
            <Icon className="h-5 w-5 text-[color:var(--sg-accent)]" />
            <h2 className="mt-4 text-base font-black">{title}</h2>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              {body}
            </p>
          </Card>
        ))}
      </section>

      <section className="bg-muted/30 flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold">
            <Check className="h-4 w-4 text-[color:var(--sg-accent)]" />
            Your Studio work remains available in the browser
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Keep planning or publishing while the native editor handles your
            media.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/studio/library">
              Content Library <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a
              href="https://github.com/keremgurel/yapper/releases/latest"
              target="_blank"
              rel="noreferrer"
            >
              Release notes <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>
    </div>
  );
}
