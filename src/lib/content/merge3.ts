/**
 * Three-way merge of two edits of one list, at item granularity.
 *
 * `base` is the list both sides started from, `ours` the edit being saved and
 * `theirs` what is stored now. Each side's changes are hunks against the
 * base (a stretch replaced, removed or inserted). Hunks that do not overlap
 * all apply, so a block appended by Chirpy and a line typed into another
 * block both survive; two insertions at one spot keep both, ours first.
 * Where both sides changed the same stretch, ours wins, because it is the
 * creator's newest typing. Lists too long to compare cheaply (a canvas has
 * at most a few dozen blocks) are not merged: ours is kept as sent.
 */
export function merge3<T>(
  base: readonly T[],
  ours: readonly T[],
  theirs: readonly T[],
  same: (a: T, b: T) => boolean,
): T[] {
  // The comparison table is base × other cells, and both lists can come
  // from a client, so its size is capped.
  if (
    (base.length + 1) * (Math.max(ours.length, theirs.length) + 1) >
    MAX_CELLS
  )
    return [...ours];
  const all = [
    ...hunks(base, ours, same, true),
    ...hunks(base, theirs, same, false),
  ].sort(byPosition);
  const applied: Hunk<T>[] = [];
  const taken = new Set<Hunk<T>>();
  for (const hunk of all) {
    if (taken.has(hunk)) continue;
    // Gather every hunk this one touches on the other side, transitively.
    const group = [hunk];
    for (let grew = true; grew; ) {
      grew = false;
      for (const other of all)
        if (
          !group.includes(other) &&
          !taken.has(other) &&
          group.some((member) => clash(member, other))
        ) {
          group.push(other);
          grew = true;
        }
    }
    for (const member of group) taken.add(member);
    applied.push(group.length === 1 ? hunk : resolve(group, base, same));
  }
  applied.sort(byPosition);

  const result: T[] = [];
  let at = 0;
  for (const hunk of applied) {
    result.push(...base.slice(at, hunk.start), ...hunk.items);
    at = hunk.end;
  }
  result.push(...base.slice(at));
  return result;
}

const MAX_CELLS = 40_000;

interface Hunk<T> {
  /** The base stretch [start, end) this replaces; empty for an insertion. */
  start: number;
  end: number;
  items: T[];
  ours: boolean;
}

const byPosition = <T>(a: Hunk<T>, b: Hunk<T>) =>
  a.start - b.start || a.end - a.start - (b.end - b.start);

/** Hunks of different sides that cannot both apply. */
function clash<T>(a: Hunk<T>, b: Hunk<T>): boolean {
  if (a.ours === b.ours) return false;
  const aInsert = a.start === a.end;
  const bInsert = b.start === b.end;
  if (aInsert && bInsert) return a.start === b.start;
  if (aInsert) return b.start < a.start && a.start < b.end;
  if (bInsert) return a.start < b.start && b.start < a.end;
  return a.start < b.end && b.start < a.end;
}

/** One hunk for a group that overlaps: both insertions when that is all it
 * is, otherwise our version of the whole stretch. */
function resolve<T>(
  group: Hunk<T>[],
  base: readonly T[],
  same: (a: T, b: T) => boolean,
): Hunk<T> {
  const start = Math.min(...group.map((hunk) => hunk.start));
  const end = Math.max(...group.map((hunk) => hunk.end));
  const ours = group.filter((hunk) => hunk.ours).sort(byPosition);
  if (start === end) {
    const theirs = group.find((hunk) => !hunk.ours)!.items;
    const mine = ours[0].items;
    const equal =
      mine.length === theirs.length &&
      mine.every((item, index) => same(item, theirs[index]));
    return {
      start,
      end,
      items: equal ? mine : [...mine, ...theirs],
      ours: true,
    };
  }
  const items: T[] = [];
  let at = start;
  for (const hunk of ours) {
    items.push(...base.slice(at, hunk.start), ...hunk.items);
    at = hunk.end;
  }
  items.push(...base.slice(at, end));
  return { start, end, items, ours: true };
}

/** One side's changes as hunks against the base, from a longest common
 * subsequence of the two lists. */
function hunks<T>(
  base: readonly T[],
  other: readonly T[],
  same: (a: T, b: T) => boolean,
  ours: boolean,
): Hunk<T>[] {
  const pairs = [
    ...matches(base, other, same),
    [base.length, other.length] as const,
  ];
  const result: Hunk<T>[] = [];
  let i = 0;
  let j = 0;
  for (const [bi, oj] of pairs) {
    if (bi > i || oj > j)
      result.push({ start: i, end: bi, items: other.slice(j, oj), ours });
    i = bi + 1;
    j = oj + 1;
  }
  return result;
}

/** Index pairs of a longest common subsequence, in order. */
function matches<T>(
  base: readonly T[],
  other: readonly T[],
  same: (a: T, b: T) => boolean,
): (readonly [number, number])[] {
  const length = Array.from({ length: base.length + 1 }, () =>
    new Array<number>(other.length + 1).fill(0),
  );
  for (let i = base.length - 1; i >= 0; i--)
    for (let j = other.length - 1; j >= 0; j--)
      length[i][j] = same(base[i], other[j])
        ? length[i + 1][j + 1] + 1
        : Math.max(length[i + 1][j], length[i][j + 1]);
  const pairs: (readonly [number, number])[] = [];
  let i = 0;
  let j = 0;
  while (i < base.length && j < other.length) {
    if (same(base[i], other[j])) pairs.push([i++, j++]);
    else if (length[i + 1][j] >= length[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}
