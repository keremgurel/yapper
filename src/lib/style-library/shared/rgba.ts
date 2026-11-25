/** A hex colour (`#RRGGBB` or `#RRGGBBAA`) as CSS `rgba()`, with `alpha` multiplied in. */
export function rgba(hex: string, alpha = 1): string {
  const channel = (index: number) =>
    parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const own = hex.length === 9 ? channel(3) / 255 : 1;
  return `rgba(${channel(0)},${channel(1)},${channel(2)},${Number((own * alpha).toFixed(3))})`;
}
