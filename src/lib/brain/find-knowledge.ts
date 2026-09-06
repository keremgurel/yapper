/** Exact names win. A partial title is usable only when it is unambiguous. */
export function findKnowledge<T extends { title: string }>(
  blocks: readonly T[],
  query: string,
): T | null {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return null;
  const exact = blocks.filter(
    (block) => block.title.toLocaleLowerCase() === needle,
  );
  const candidates = exact.length
    ? exact
    : blocks.filter((block) =>
        block.title.toLocaleLowerCase().includes(needle),
      );
  if (candidates.length > 1) throw new Error("knowledge_ambiguous");
  return candidates[0] ?? null;
}
