"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ImagePlus,
  Loader2,
  Palette,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import {
  deleteBrandLogo,
  getBrandKit,
  makeBrandLogoPrimary,
  saveBrandColors,
  uploadBrandLogo,
  type BrandKit,
  type BrandLogo,
} from "@/lib/brand/client";

const MAX_COLORS = 8;
const MAX_LOGOS = 8;
const ACCEPTED_LOGOS = "image/png,image/jpeg,image/webp,image/svg+xml";
const STARTER_COLORS = ["#FF7A21", "#151515", "#FFFFFF", "#FFD93D"];
const HEX_COLOR = /^#[0-9A-F]{6}$/i;

function message(error: unknown): string {
  const code = error instanceof Error ? error.message : "failed";
  if (code === "not_entitled")
    return "Brand assets are available on a Studio plan.";
  if (code === "storage_full")
    return "Your storage is full. Remove media before adding a logo.";
  if (code === "logo_limit")
    return `A brand kit can hold up to ${MAX_LOGOS} logos.`;
  if (code === "media_too_large") return "Logos must be smaller than 5 MB.";
  if (code === "bad_request") return "Use a PNG, JPG, WebP, or SVG logo.";
  return "That change could not be saved. Try again.";
}

function ColorSwatch({
  color,
  primary,
  busy,
  onChange,
  onPrimary,
  onRemove,
}: {
  color: string;
  primary: boolean;
  busy: boolean;
  onChange: (color: string) => void;
  onPrimary: () => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(color);

  const commit = () => {
    const next = draft.trim().toUpperCase();
    if (HEX_COLOR.test(next) && next !== color) onChange(next);
    else setDraft(color);
  };

  return (
    <div className="border-border bg-background group overflow-hidden rounded-2xl border shadow-sm transition-transform hover:-translate-y-0.5">
      <label
        className="relative block h-28 cursor-pointer overflow-hidden"
        style={{ background: draft }}
      >
        <span className="sr-only">Choose {color}</span>
        <input
          type="color"
          value={HEX_COLOR.test(draft) ? draft : color}
          onChange={(event) => setDraft(event.target.value.toUpperCase())}
          onBlur={commit}
          disabled={busy}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
        {primary ? (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] font-black tracking-wide text-white uppercase backdrop-blur">
            <Star className="h-3 w-3 fill-current" /> Primary
          </span>
        ) : null}
      </label>
      <div className="flex items-center gap-1.5 p-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          disabled={busy}
          aria-label={`Hex value for ${color}`}
          className="text-foreground min-w-0 flex-1 bg-transparent px-1 font-mono text-xs font-bold uppercase outline-none"
        />
        {!primary ? (
          <button
            type="button"
            onClick={onPrimary}
            disabled={busy}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-1.5"
            aria-label={`Make ${color} primary`}
            title="Make primary"
          >
            <Star className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg p-1.5"
          aria-label={`Remove ${color}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function LogoCard({
  logo,
  busy,
  onPrimary,
  onRemove,
}: {
  logo: BrandLogo;
  busy: boolean;
  onPrimary: () => void;
  onRemove: () => void;
}) {
  return (
    <article className="border-border bg-background overflow-hidden rounded-2xl border shadow-sm">
      <div className="relative flex h-40 items-center justify-center overflow-hidden bg-[linear-gradient(45deg,var(--sg-border)_25%,transparent_25%),linear-gradient(-45deg,var(--sg-border)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--sg-border)_75%),linear-gradient(-45deg,transparent_75%,var(--sg-border)_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0px] p-7">
        {/* User-owned URLs are presigned dynamically, so they cannot use Next Image's host allowlist. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo.url}
          alt={logo.name}
          className="max-h-full max-w-full object-contain drop-shadow-sm"
        />
        {logo.isPrimary ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-[color:var(--sg-accent)] px-2.5 py-1 text-[10px] font-black tracking-wide text-white uppercase shadow-sm">
            <Star className="h-3 w-3 fill-current" /> Primary
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 border-t border-[color:var(--sg-border)] px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-black">
            {logo.name}
          </p>
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            {Math.max(1, Math.round(logo.mediaBytes / 1024))} KB
          </p>
        </div>
        {!logo.isPrimary ? (
          <button
            type="button"
            onClick={onPrimary}
            disabled={busy}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2"
            aria-label={`Make ${logo.name} primary`}
            title="Make primary"
          >
            <Star className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg p-2"
          aria-label={`Remove ${logo.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

export default function BrandPanel() {
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setError(null);
    getBrandKit().then(setKit, (cause) => setError(message(cause)));
  }, []);

  useEffect(load, [load]);

  const persistColors = async (colors: string[]) => {
    if (!kit || busy) return;
    const previous = kit;
    setKit({ ...kit, colors });
    setBusy(true);
    setError(null);
    try {
      setKit(await saveBrandColors(colors));
    } catch (cause) {
      setKit(previous);
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file || busy || !kit) return;
    if (
      !ACCEPTED_LOGOS.split(",").includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError(
        file.size > 5 * 1024 * 1024
          ? "Logos must be smaller than 5 MB."
          : "Use a PNG, JPG, WebP, or SVG logo.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const logo = await uploadBrandLogo(file);
      setKit((current) =>
        current ? { ...current, logos: [...current.logos, logo] } : current,
      );
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = "";
    }
  };

  const primaryLogo =
    kit?.logos.find((logo) => logo.isPrimary) ?? kit?.logos[0];
  const primaryColor = kit?.colors[0] ?? STARTER_COLORS[0];
  const supportingColor = kit?.colors[1] ?? STARTER_COLORS[1];

  return (
    <div className="w-full pb-16">
      <header className="mb-7 flex items-start gap-4">
        <div className="border-border bg-card flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm">
          <Palette className="text-foreground h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
            Brand kit
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
            Set it once. Chirpy will use these colors and logos whenever it
            creates graphics for your videos.
          </p>
        </div>
      </header>

      <section className="border-border relative mb-8 overflow-hidden rounded-3xl border bg-[#111214] shadow-sm">
        <div
          className="absolute inset-0 opacity-45"
          style={{
            background: `radial-gradient(circle at 85% 15%, ${primaryColor}66, transparent 38%), linear-gradient(120deg, ${supportingColor}, #111214 58%)`,
          }}
        />
        <div className="relative flex min-h-52 items-end justify-between gap-8 p-6 sm:p-8">
          <div className="max-w-lg">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[11px] font-black tracking-[0.12em] text-white/75 uppercase backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Chirpy-ready
            </span>
            <h2 className="font-display text-2xl font-black tracking-tight text-white sm:text-3xl">
              One visual identity across every overlay.
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/60">
              Numbers, charts, lower thirds, and logo moments can inherit this
              kit automatically.
            </p>
          </div>
          {primaryLogo ? (
            <div className="hidden h-24 w-44 items-center justify-center rounded-2xl border border-white/15 bg-white/90 p-5 shadow-2xl sm:flex">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={primaryLogo.url}
                alt="Primary brand logo preview"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="hidden h-24 w-44 items-center justify-center rounded-2xl border border-dashed border-white/20 text-xs font-bold text-white/40 sm:flex">
              Your logo here
            </div>
          )}
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-sm font-bold text-amber-700 dark:text-amber-300"
        >
          {error}
        </div>
      ) : null}

      <section className="border-border bg-card mb-8 rounded-3xl border p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-lg font-black">Logos</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Add light, dark, icon, or wordmark versions. Mark the one Chirpy
              should reach for first.
            </p>
          </div>
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={busy || (kit?.logos.length ?? 0) >= MAX_LOGOS}
            className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-black disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}{" "}
            Upload logo
          </button>
          <input
            ref={picker}
            type="file"
            accept={ACCEPTED_LOGOS}
            className="sr-only"
            onChange={(event) =>
              event.target.files && void upload(event.target.files)
            }
          />
        </div>

        {kit === null ? (
          <div className="border-border text-muted-foreground flex items-center gap-2 rounded-2xl border border-dashed px-4 py-12 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your brand kit…
          </div>
        ) : kit.logos.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kit.logos.map((logo) => (
              <LogoCard
                key={logo.id}
                logo={logo}
                busy={busy}
                onPrimary={() => {
                  setBusy(true);
                  setError(null);
                  makeBrandLogoPrimary(logo.id)
                    .then(
                      () =>
                        setKit((current) =>
                          current
                            ? {
                                ...current,
                                logos: current.logos.map((item) => ({
                                  ...item,
                                  isPrimary: item.id === logo.id,
                                })),
                              }
                            : current,
                        ),
                      (cause) => setError(message(cause)),
                    )
                    .finally(() => setBusy(false));
                }}
                onRemove={() => {
                  if (
                    !window.confirm(
                      `Remove “${logo.name}” from your brand kit?`,
                    )
                  )
                    return;
                  setBusy(true);
                  setError(null);
                  deleteBrandLogo(logo.id)
                    .then(
                      () => load(),
                      (cause) => setError(message(cause)),
                    )
                    .finally(() => setBusy(false));
                }}
              />
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => picker.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void upload(event.dataTransfer.files);
            }}
            className={`flex w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center transition-colors ${dragging ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)]/8" : "border-border bg-muted/20 hover:bg-muted/35"}`}
          >
            <span className="bg-background border-border mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm">
              <ImagePlus className="text-foreground h-5 w-5" />
            </span>
            <span className="text-foreground text-sm font-black">
              Drop a logo here
            </span>
            <span className="text-muted-foreground mt-1 text-xs">
              PNG, JPG, WebP, or SVG · up to 5 MB
            </span>
          </button>
        )}
      </section>

      <section className="border-border bg-card rounded-3xl border p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-lg font-black">Colors</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              The first swatch is primary. Chirpy will check contrast and choose
              readable combinations automatically.
            </p>
          </div>
          <button
            type="button"
            disabled={busy || !kit || kit.colors.length >= MAX_COLORS}
            onClick={() => {
              if (!kit) return;
              const next =
                STARTER_COLORS.find((color) => !kit.colors.includes(color)) ??
                "#3B9DFF";
              void persistColors([...kit.colors, next]);
            }}
            className="border-border bg-background text-foreground hover:bg-muted inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-black disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add color
          </button>
        </div>

        {kit === null ? (
          <div className="border-border text-muted-foreground flex items-center gap-2 rounded-2xl border border-dashed px-4 py-12 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading colors…
          </div>
        ) : kit.colors.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kit.colors.map((color, index) => (
              <ColorSwatch
                key={color}
                color={color}
                primary={index === 0}
                busy={busy}
                onChange={(next) =>
                  void persistColors(
                    kit.colors.map((item) => (item === color ? next : item)),
                  )
                }
                onPrimary={() =>
                  void persistColors([
                    color,
                    ...kit.colors.filter((item) => item !== color),
                  ])
                }
                onRemove={() =>
                  void persistColors(
                    kit.colors.filter((item) => item !== color),
                  )
                }
              />
            ))}
          </div>
        ) : (
          <div className="border-border flex flex-col items-start gap-4 rounded-2xl border border-dashed bg-[linear-gradient(120deg,color-mix(in_srgb,var(--sg-accent)_8%,transparent),transparent)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-foreground text-sm font-black">
                Start with safe defaults
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Yapper orange, ink, white, and highlight yellow form a readable
                starter palette.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void persistColors(STARTER_COLORS)}
              className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-black"
            >
              <Check className="h-4 w-4" /> Use defaults
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
