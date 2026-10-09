/** Home's opening line: the time of day and, when known, the creator's first
 * name. The hour is local, so a creator working at 1am is not told good
 * morning. */
export function greeting(hour: number, firstName?: string | null): string {
  const phrase =
    hour >= 5 && hour < 12
      ? "Good morning"
      : hour >= 12 && hour < 17
        ? "Good afternoon"
        : hour >= 17 && hour < 22
          ? "Good evening"
          : "Working late";
  const name = firstName?.trim();
  return name ? `${phrase}, ${name}` : phrase;
}
