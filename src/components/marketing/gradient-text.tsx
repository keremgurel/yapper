import type { ReactNode } from "react";

/**
 * The second line of a headline, run through the brand spectrum.
 *
 * Coral into rose into periwinkle. It is used on exactly one line per page:
 * the trick works because the line above it is plain white, and stops working
 * the moment two things on screen are doing it.
 */
export default function GradientText({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(100deg, #F96F4B 0%, #E88A86 32%, #A79BE0 62%, #7E93E8 100%)",
      }}
    >
      {children}
    </span>
  );
}
