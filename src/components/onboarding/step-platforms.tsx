"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import StepShell from "@/components/onboarding/step-shell";
import type { SocialHandle } from "@/hooks/use-studio-onboarding";
import { PLATFORMS, PLATFORM_BY_ID } from "@/components/onboarding/platforms";
import type { ReactNode } from "react";

/** "Where do you post?" — type a username and press Enter to commit it as a
 * removable chip (icon + @handle), exactly like content pillars. Instagram is
 * the default active input; the chips below switch which platform you're adding.
 * Everything is optional; the footer makes the skip explicit. */
export default function StepPlatforms({
  stepIndex,
  socials,
  onChange,
  onBack,
  footer,
}: {
  stepIndex: number;
  socials: SocialHandle[];
  onChange: (next: SocialHandle[]) => void;
  onBack: () => void;
  footer: ReactNode;
}) {
  const committed = new Set(socials.map((s) => s.platform));
  const firstFree = PLATFORMS.find((p) => !committed.has(p.id));
  const [active, setActive] = useState<string>(firstFree?.id ?? "instagram");
  const [draft, setDraft] = useState("");

  const activePlatform = PLATFORM_BY_ID[active] ?? PLATFORMS[0];

  const commit = () => {
    const username = draft.trim().replace(/^@/, "");
    if (!username || committed.has(active)) return;
    onChange([...socials, { platform: active, username }]);
    setDraft("");
    // Jump the input to the next platform they haven't added yet.
    const next = PLATFORMS.find((p) => p.id !== active && !committed.has(p.id));
    if (next) setActive(next.id);
  };

  const remove = (platform: string) => {
    onChange(socials.filter((s) => s.platform !== platform));
    setActive(platform); // make the freed platform the active input again
    setDraft("");
  };

  const selectable = PLATFORMS.filter(
    (p) => !committed.has(p.id) && p.id !== active,
  );
  const allAdded = committed.size === PLATFORMS.length;

  return (
    <StepShell
      stepIndex={stepIndex}
      title="Where do you post?"
      subtitle="Add the accounts you create for so every idea and script fits your voice. Type a username and press enter — or skip this and set it up later."
      onBack={onBack}
      footer={footer}
    >
      {/* Committed handles as removable icon chips (same as pillars) */}
      {socials.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {socials.map((s) => {
            const p = PLATFORM_BY_ID[s.platform];
            if (!p) return null;
            return (
              <span
                key={s.platform}
                className="text-foreground inline-flex items-center gap-1.5 rounded-md bg-[color:var(--sg-accent)]/15 px-2.5 py-1 text-sm font-semibold"
              >
                <p.Icon className="h-3.5 w-3.5" />
                {p.prefix}
                {s.username}
                <button
                  type="button"
                  onClick={() => remove(s.platform)}
                  aria-label={`Remove ${p.label}`}
                  className="text-foreground/50 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Active input row: pick platform via chips below, type + Enter to commit */}
      {!allAdded && (
        <div className="border-border bg-muted/40 flex items-center gap-2 rounded-md border py-1.5 pr-2 pl-3">
          <activePlatform.Icon className="text-foreground/80 h-4 w-4 shrink-0" />
          <span className="text-foreground/50 text-sm font-semibold select-none">
            {activePlatform.prefix}
          </span>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
            placeholder={activePlatform.placeholder}
            aria-label={`${activePlatform.label} username`}
            autoFocus
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
      )}

      {/* Switch which platform you're adding */}
      {selectable.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectable.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setActive(p.id);
                setDraft("");
              }}
              className="border-border text-foreground/80 hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-semibold"
            >
              <p.Icon className="h-4 w-4" />
              {p.label}
            </button>
          ))}
        </div>
      )}
    </StepShell>
  );
}
