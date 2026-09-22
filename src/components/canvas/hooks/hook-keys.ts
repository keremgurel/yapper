/** A stable identity for each hook, so a line keeps its element (and its
 * motion) as it moves between the chosen slot and the alternatives. Two
 * identical lines get their occurrence appended. */
export function hookKeys(hooks: string[]): string[] {
  const seen = new Map<string, number>();
  return hooks.map((hook) => {
    const count = seen.get(hook) ?? 0;
    seen.set(hook, count + 1);
    return `${hook}#${count}`;
  });
}
