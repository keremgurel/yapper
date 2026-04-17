"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import {
  AudioWaveform,
  BrainCircuit,
  Gauge,
  MessageSquareText,
} from "lucide-react";
import { useTheme } from "next-themes";
import { SparklesCore } from "@/components/sparkles";

/* ------------------------------------------------------------------ */
/*  Shared submit helper                                               */
/* ------------------------------------------------------------------ */

async function submitWaitlist(email: string): Promise<string> {
  const { trackWaitlistSubmitted, identifyUser } =
    await import("@/lib/analytics");
  const res = await fetch("/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
  };
  if (!res.ok || !data.success) {
    trackWaitlistSubmitted({ success: false });
    throw new Error(data.error ?? "Something went wrong. Please try again.");
  }
  trackWaitlistSubmitted({ success: true });
  identifyUser(email, { email, waitlist: true });
  return "You're on the list! We'll be in touch.";
}

/* ------------------------------------------------------------------ */
/*  Feature items for the "what's coming" column                       */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: AudioWaveform,
    title: "Filler word detection",
    desc: "Spots every um, uh, like, and you know so you can cut them out.",
  },
  {
    icon: Gauge,
    title: "Pacing analysis",
    desc: "Tracks your words-per-minute and flags when you rush or drag.",
  },
  {
    icon: BrainCircuit,
    title: "Structure scoring",
    desc: "Evaluates how clearly you open, transition, and close your speech.",
  },
  {
    icon: MessageSquareText,
    title: "Personalized tips",
    desc: "Actionable feedback tailored to your speaking patterns after each take.",
  },
];

/* ------------------------------------------------------------------ */
/*  Email form with glow lines + sparkles                              */
/* ------------------------------------------------------------------ */

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const sparkleColor =
    mounted && resolvedTheme === "light" ? "#0891B2" : "#95D2E6";

  const isSuccess = message.includes("on the list");

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!email.trim()) {
        setMessage("Enter a valid email.");
        return;
      }
      setLoading(true);
      setMessage("");
      try {
        const successMsg = await submitWaitlist(email);
        setMessage(successMsg);
        setEmail("");
      } catch (err) {
        setMessage(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      } finally {
        setLoading(false);
      }
    },
    [email],
  );

  return (
    <div className="relative w-full">
      <div className="waitlist-card relative rounded-2xl p-3 shadow-lg backdrop-blur-md">
        {!message || !isSuccess ? (
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                autoComplete="email"
                required
                aria-invalid={
                  message && !isSuccess ? ("true" as const) : undefined
                }
                className="waitlist-input min-w-0 flex-1 rounded-xl px-4 py-3.5 text-[15px] outline-hidden transition-shadow"
              />
              <button
                type="submit"
                disabled={!email.trim() || loading}
                className="waitlist-btn shrink-0 cursor-pointer rounded-xl px-6 py-3.5 text-[14px] font-semibold whitespace-nowrap transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Joining...
                  </span>
                ) : (
                  "Join Waitlist"
                )}
              </button>
            </div>
            {message && !isSuccess && (
              <p className="mt-2 px-1 text-[13px] text-red-400" role="alert">
                {message}
              </p>
            )}
          </form>
        ) : (
          <div
            className="animate-fade-slide-in flex items-center justify-center rounded-xl bg-emerald-500/10 px-5 py-3.5 text-[14px] font-medium text-emerald-400"
            role="status"
          >
            {message}
          </div>
        )}
      </div>

      {/* Glow lines */}
      <div className="pointer-events-none absolute inset-x-[15%] bottom-0 h-[2px] w-[70%] bg-gradient-to-r from-transparent via-indigo-500 to-transparent blur-[2px]" />
      <div className="pointer-events-none absolute inset-x-[15%] bottom-0 h-px w-[70%] bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
      <div className="pointer-events-none absolute inset-x-[30%] bottom-0 h-[5px] w-[40%] bg-gradient-to-r from-transparent via-sky-500 to-transparent blur-[2px]" />
      <div className="pointer-events-none absolute inset-x-[30%] bottom-0 h-px w-[40%] bg-gradient-to-r from-transparent via-sky-500 to-transparent" />

      {/* Sparkle field below the card */}
      <div className="absolute right-0 -bottom-[120px] left-0 h-[120px]">
        <div
          className="absolute inset-0"
          style={{
            maskImage:
              "radial-gradient(100% 100% at 50% 0%, black 30%, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(100% 100% at 50% 0%, black 30%, transparent 70%)",
          }}
        >
          {mounted && (
            <SparklesCore
              background="transparent"
              minSize={0.4}
              maxSize={1.2}
              particleDensity={800}
              className="h-full w-full"
              particleColor={sparkleColor}
              speed={3}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cinematic pre-footer waitlist (planet horizon style)               */
/* ------------------------------------------------------------------ */

function CinematicWaitlist({ className = "" }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => setMounted(true), []);

  const isSuccess = message.includes("on the list");

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!email.trim()) {
        setMessage("Enter a valid email.");
        return;
      }
      setLoading(true);
      setMessage("");
      try {
        const successMsg = await submitWaitlist(email);
        setMessage(successMsg);
        setEmail("");
      } catch (err) {
        setMessage(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      } finally {
        setLoading(false);
      }
    },
    [email],
  );

  return (
    <section
      className={`cinematic-waitlist relative w-full overflow-hidden rounded-t-[2rem] ${className}`}
      style={{ background: "oklch(0.1822 0 0)" }}
    >
      {/* Star particles */}
      <div className="absolute inset-0 z-0">
        {mounted && (
          <SparklesCore
            id="cinematic-stars"
            background="transparent"
            minSize={0.3}
            maxSize={1.0}
            particleDensity={400}
            className="h-full w-full"
            particleColor="#ffffff"
            speed={1.5}
          />
        )}
      </div>

      {/* Waitlist content */}
      <div className="relative z-20 mx-auto flex max-w-[1200px] flex-col items-center px-6 pt-24 pb-72 text-center sm:pt-32 sm:pb-96">
        <h2
          className="font-display mx-auto max-w-[600px] leading-[1.1] font-medium sm:leading-[1.1]"
          style={{
            color: "#f0f0f0",
            fontSize: "clamp(36px, 5vw, 60px)",
            letterSpacing: "-3px",
          }}
        >
          AI speech coaching is coming
        </h2>
        <p
          className="mx-auto mt-6 max-w-[420px] leading-[1.5]"
          style={{
            color: "rgba(255, 255, 255, 0.56)",
            fontSize: "16px",
            letterSpacing: "-0.64px",
          }}
        >
          Get early access to personalized feedback on filler words, pacing, and
          delivery. Join the waitlist.
        </p>

        {/* Email form - button inside input, matching reference exactly */}
        <div className="mt-10 w-full max-w-[395px]">
          {!isSuccess ? (
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <input
                  type="email"
                  placeholder="Your Email Address"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setEmail(e.target.value)
                  }
                  autoComplete="email"
                  required
                  className="w-full outline-hidden"
                  style={{
                    background: "rgba(10, 10, 10, 0.56)",
                    color: "#ffffff",
                    fontSize: "14px",
                    letterSpacing: "-0.56px",
                    padding: "16px 140px 16px 16px",
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "rgba(255, 255, 255, 0.1) 0px 0px 0px 1px inset",
                  }}
                />
                <button
                  type="submit"
                  disabled={!email.trim() || loading}
                  className="absolute top-1/2 right-[5px] -translate-y-1/2 cursor-pointer transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: "#f0f0f0",
                    color: "#0a0a0a",
                    fontSize: "14px",
                    fontWeight: "500",
                    padding: "0 16px",
                    height: "39px",
                    borderRadius: "3px",
                    border: "none",
                  }}
                >
                  {loading ? "Joining..." : "Get Notified"}
                </button>
              </div>
              {message && !isSuccess && (
                <p className="mt-2 px-1 text-[13px] text-red-400" role="alert">
                  {message}
                </p>
              )}
            </form>
          ) : (
            <div
              className="animate-fade-slide-in rounded-lg bg-emerald-500/10 px-5 py-3 text-[14px] font-medium text-emerald-400"
              role="status"
            >
              {message}
            </div>
          )}
        </div>
      </div>

      {/* Top gradient fade */}
      <div
        className="cinematic-top-fade pointer-events-none absolute top-0 right-0 left-0 z-10"
        style={{ height: "100px" }}
      />

      {/* Atmospheric glow above planet */}
      <div
        className="pointer-events-none absolute z-10"
        style={{
          width: "787px",
          height: "111px",
          bottom: "360px",
          left: "50%",
          transform: "translateX(-50%)",
          background:
            "radial-gradient(50% 50%, rgba(255, 255, 255, 0.5) 0%, rgba(10, 10, 10, 0) 100%)",
          filter: "blur(57px)",
        }}
      />

      {/* Planet horizon arc */}
      <div
        className="pointer-events-none absolute z-[5]"
        style={{
          width: "min(1400px, 110%)",
          height: "700px",
          borderRadius: "100%",
          background: "oklch(0.1822 0 0)",
          bottom: "-480px",
          left: "50%",
          transform: "translateX(-50%)",
          boxShadow:
            "rgb(255, 255, 255) 0px 2px 20px 0px inset, rgba(255, 255, 255, 0.49) 0px -10px 50px 1px",
        }}
      />

      {/* Footer content */}
      <footer className="relative z-20 mx-auto max-w-[1200px] px-6 pt-8 pb-10 sm:px-10">
        <div className="flex flex-1 flex-col items-start justify-between gap-6 md:flex-row md:gap-10">
          <div className="flex flex-col items-start gap-2">
            <Link
              href="/"
              className="font-display flex flex-row items-center justify-start gap-2 text-2xl font-extrabold no-underline"
              style={{ color: "#f0f0f0" }}
            >
              <div className="flex h-[28px] w-[28px] items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-red-500 text-sm font-black text-white">
                Y
              </div>
              yapper
            </Link>
            <p
              className="w-full text-[14px] font-medium md:w-4/5"
              style={{ color: "rgba(255, 255, 255, 0.4)" }}
            >
              Free topic generator for speech practice. Random prompts, built-in
              timer, and optional recording.
            </p>
          </div>

          <div className="flex flex-col items-start gap-4 md:flex-row md:items-start md:gap-20">
            <div className="flex flex-col gap-1 md:gap-4">
              <h4
                className="font-display text-md font-semibold uppercase"
                style={{ color: "rgba(255, 255, 255, 0.4)" }}
              >
                Product
              </h4>
              <div className="flex flex-wrap items-start gap-2 text-sm md:flex-col">
                <Link
                  className="font-medium whitespace-nowrap hover:text-white"
                  href="/random-topic-generator"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  Random Topics
                </Link>
                <Link
                  className="font-medium whitespace-nowrap hover:text-white"
                  href="/freestyle-speech"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  Freestyle
                </Link>
                <Link
                  className="font-medium whitespace-nowrap hover:text-white"
                  href="/blog"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  Blog
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-1 md:gap-4">
              <h4
                className="font-display text-md font-semibold whitespace-nowrap uppercase"
                style={{ color: "rgba(255, 255, 255, 0.4)" }}
              >
                Social
              </h4>
              <div className="flex flex-wrap items-start gap-2 text-sm md:flex-col">
                <a
                  className="font-medium whitespace-nowrap hover:text-white"
                  href="https://www.tiktok.com/@ypr.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  TikTok
                </a>
                <a
                  className="font-medium whitespace-nowrap hover:text-white"
                  href="https://www.instagram.com/ypr.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  Instagram
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-1 md:gap-4">
              <h4
                className="font-display text-md font-semibold whitespace-nowrap uppercase"
                style={{ color: "rgba(255, 255, 255, 0.4)" }}
              >
                Partners
              </h4>
              <div className="flex flex-wrap items-start gap-2 text-sm md:flex-col">
                <a
                  className="font-medium whitespace-nowrap hover:text-white"
                  href="http://onchainsite.xyz/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  Onchainsite
                </a>
                <a
                  className="font-medium whitespace-nowrap hover:text-white"
                  href="https://www.coglyde.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "rgba(255, 255, 255, 0.4)" }}
                >
                  Coglyde
                </a>
              </div>
            </div>
          </div>
        </div>

        <div
          className="mt-6 flex w-full flex-col items-start justify-between gap-4 border-t pt-6 text-sm md:flex-row md:items-center"
          style={{
            borderTopColor: "rgba(255, 255, 255, 0.08)",
            color: "rgba(255, 255, 255, 0.4)",
          }}
        >
          <p className="whitespace-nowrap">
            &copy;{currentYear} OCX Software Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://www.tiktok.com/@ypr.app"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="yapper on TikTok"
              className="hover:text-white"
              style={{ color: "rgba(255, 255, 255, 0.4)" }}
            >
              <svg
                className="h-5 w-5 fill-current"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15Z" />
              </svg>
            </a>
            <a
              href="https://www.instagram.com/ypr.app/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="yapper on Instagram"
              className="hover:text-white"
              style={{ color: "rgba(255, 255, 255, 0.4)" }}
            >
              <svg
                className="h-5 w-5 fill-current"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" />
              </svg>
            </a>
            <a
              href="https://x.com/openclawfred"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="yapper on X (formerly Twitter)"
              className="hover:text-white"
              style={{ color: "rgba(255, 255, 255, 0.4)" }}
            >
              <svg
                className="h-5 w-5 fill-current"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Waitlist component                                                 */
/* ------------------------------------------------------------------ */

interface WaitlistProps {
  /** full = two-column features + form. minimal = sleek pre-footer strip. */
  variant?: "full" | "minimal";
  className?: string;
}

export default function Waitlist({
  variant = "full",
  className = "",
}: WaitlistProps) {
  /* ---- Minimal: cinematic full-bleed section with horizon glow ---- */
  if (variant === "minimal") {
    return <CinematicWaitlist className={className} />;
  }

  /* ---- Full: two-column "what's coming" + form ---- */
  return (
    <section className={`relative px-4 py-16 sm:px-6 sm:py-24 ${className}`}>
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left column: what's coming */}
        <div>
          <p className="waitlist-label mb-3 text-[13px] font-semibold tracking-[0.08em] uppercase">
            Coming soon
          </p>
          <h2 className="waitlist-heading font-display mb-3 text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] sm:text-[32px]">
            AI-powered speech coaching
          </h2>
          <p className="waitlist-subtext mb-8 text-[14px] leading-[1.7] sm:text-[15px]">
            Practice is step one. Soon, Yapper will listen to your recordings
            and give you real feedback.
          </p>

          <ul className="flex flex-col gap-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3.5">
                <div className="waitlist-icon-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <f.icon
                    className="waitlist-icon h-[18px] w-[18px]"
                    strokeWidth={1.8}
                  />
                </div>
                <div className="min-w-0">
                  <p className="waitlist-heading text-[14px] leading-snug font-semibold sm:text-[15px]">
                    {f.title}
                  </p>
                  <p className="waitlist-subtext mt-0.5 text-[13px] leading-[1.5] sm:text-[14px]">
                    {f.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Right column: form */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <h3 className="waitlist-heading font-display mb-2 text-[20px] font-semibold tracking-[-0.01em] sm:text-[22px]">
            Get early access
          </h3>
          <p className="waitlist-subtext mb-6 text-[14px] leading-[1.6]">
            Be first to try it. Waitlist members get priority access when we
            launch.
          </p>
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
