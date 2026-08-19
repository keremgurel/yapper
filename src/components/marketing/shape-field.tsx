import Image from "next/image";

/**
 * The drift of stadium shapes and icon tiles along the foot of a dark panel.
 *
 * Half the shapes are filled and half are hairline outlines, at mixed angles
 * and sizes, so it reads as scattered rather than arranged. It carries no
 * information, which is why the whole thing is hidden from assistive tech and
 * why it thins out on small screens instead of shrinking.
 */
const PILLS: {
  left: string;
  bottom: string;
  w: string;
  h: string;
  rotate: string;
  fill?: string;
  hideBelowLg?: boolean;
}[] = [
  {
    left: "2%",
    bottom: "26%",
    w: "17rem",
    h: "5rem",
    rotate: "-9deg",
    fill: "#F5F2E6",
  },
  {
    left: "14%",
    bottom: "8%",
    w: "13rem",
    h: "4.25rem",
    rotate: "4deg",
    hideBelowLg: true,
  },
  { left: "26%", bottom: "20%", w: "15rem", h: "4.5rem", rotate: "-6deg" },
  {
    left: "31%",
    bottom: "3%",
    w: "12rem",
    h: "4rem",
    rotate: "8deg",
    fill: "#F96F4B",
  },
  {
    left: "47%",
    bottom: "12%",
    w: "13rem",
    h: "4.25rem",
    rotate: "-4deg",
    hideBelowLg: true,
  },
  {
    left: "60%",
    bottom: "6%",
    w: "16rem",
    h: "4.75rem",
    rotate: "3deg",
    fill: "#8296E8",
  },
  {
    left: "74%",
    bottom: "24%",
    w: "12rem",
    h: "4rem",
    rotate: "-7deg",
    hideBelowLg: true,
  },
  { left: "82%", bottom: "9%", w: "14rem", h: "4.5rem", rotate: "6deg" },
];

const TILES: { icon: string; left: string; bottom: string; size: number }[] = [
  { icon: "icon-mic", left: "9%", bottom: "14%", size: 54 },
  { icon: "icon-timer", left: "23%", bottom: "4%", size: 46 },
  { icon: "icon-score", left: "41%", bottom: "22%", size: 50 },
  { icon: "icon-sparkles", left: "56%", bottom: "2%", size: 46 },
  { icon: "icon-chart", left: "70%", bottom: "16%", size: 52 },
  { icon: "icon-trophy", left: "88%", bottom: "22%", size: 48 },
];

export default function ShapeField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[15rem] sm:h-[17rem]"
    >
      {PILLS.map((pill, i) => (
        <span
          key={i}
          className={`absolute rounded-full ${pill.hideBelowLg ? "hidden lg:block" : ""}`}
          style={{
            left: pill.left,
            bottom: pill.bottom,
            width: pill.w,
            height: pill.h,
            transform: `rotate(${pill.rotate})`,
            background: pill.fill ?? "transparent",
            border: pill.fill ? "none" : "1px solid rgba(255,255,255,0.42)",
          }}
        />
      ))}

      {TILES.map((tile) => (
        <span
          key={tile.icon}
          className="absolute grid place-items-center rounded-2xl"
          style={{
            left: tile.left,
            bottom: tile.bottom,
            width: tile.size,
            height: tile.size,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(2px)",
          }}
        >
          <Image
            src={`/icons3d/${tile.icon}.png`}
            alt=""
            width={tile.size - 14}
            height={tile.size - 14}
          />
        </span>
      ))}
    </div>
  );
}
