/** A length of time the way the time-saved card says it: "72 hr 3 min",
 * "45 min", "2 hr". Under a minute reads as "Under a minute", and nothing
 * yet as "0 min". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 min";
  const minutes = Math.round(seconds / 60);
  if (minutes === 0) return "Under a minute";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest
    ? `${hours.toLocaleString()} hr ${rest} min`
    : `${hours.toLocaleString()} hr`;
}
