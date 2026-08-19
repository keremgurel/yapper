import type { ReactNode } from "react";

/**
 * The inset dark stage.
 *
 * A warm near-black slab set into the page with a large radius, lit by two
 * soft off-centre glows and finished with a film grain. The grain is the part
 * that actually sells it: without it the gradients band visibly on wide
 * screens and the whole thing reads as a cheap CSS backdrop.
 *
 * Identical in both themes on purpose. It is a stage, not a surface, so it
 * does not invert; the page around it is what changes.
 */
export default function DarkPanel({
  children,
  className = "",
  glow = "cool",
}: {
  children: ReactNode;
  className?: string;
  /** `cool` leans blue and violet, `warm` leans coral and amber. */
  glow?: "cool" | "warm";
}) {
  const glows =
    glow === "cool"
      ? `radial-gradient(60% 50% at 18% 72%, rgba(96,116,214,0.30), transparent 70%),
         radial-gradient(55% 45% at 82% 66%, rgba(196,120,150,0.22), transparent 70%),
         radial-gradient(70% 55% at 50% 108%, rgba(140,120,200,0.20), transparent 70%)`
      : `radial-gradient(60% 50% at 22% 78%, rgba(249,111,75,0.26), transparent 70%),
         radial-gradient(55% 45% at 78% 70%, rgba(255,158,31,0.18), transparent 70%),
         radial-gradient(70% 55% at 50% 108%, rgba(120,110,190,0.18), transparent 70%)`;

  return (
    <div
      className={`relative isolate overflow-hidden rounded-[28px] sm:rounded-[36px] ${className}`}
      // The hairline is what keeps the slab reading as a stage set into the
      // page rather than dissolving into it when the page is already dark.
      style={{
        background: "#131114",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: glows }}
      />

      {/* Grain. Generated rather than shipped as an asset, so it costs nothing
          to download and scales to any panel size. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        }}
      />

      {/* The faint architectural rules the reference runs down its panels. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundPosition: "18% 0, 82% 0",
          backgroundSize: "1px 100%, 1px 100%",
          backgroundRepeat: "no-repeat",
        }}
      />

      <div className="relative">{children}</div>
    </div>
  );
}
