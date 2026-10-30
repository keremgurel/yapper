import { isDeepStrictEqual } from "node:util";

/**
 * Deterministic checks on a value found by JSON pointer.
 *
 * A predicate is `{ pointer, ...ops }`. The pointer is RFC 6901 with one
 * extension: a negative array index counts from the end (`/keys/-1` is the
 * last key). Every op present must hold. Ops:
 *
 *   equals, matches (+flags), contains, containsAll, sameSet, keys, length,
 *   minLength, gt, gte, lt, lte, absent, every, some, anyOf, allOf,
 *   rangeNumbers   [{first,last}] ranges expand to exactly these numbers
 *   centerX        {x,width} has x + width / 2 meeting a nested comparison
 *   rectOverlap    {rect, minCoverage, minIoU} against a reference rectangle
 *
 * `every`, `some`, `anyOf` and `allOf` take nested predicates whose pointers
 * are relative to each element (or to the current value).
 *
 * Returns a list of failure strings; empty means the predicate held.
 */
export function check(root, predicate, where = "") {
  const pointer = predicate.pointer ?? "";
  const value = resolve(root, pointer);
  const at = `${where}${pointer}` || "/";
  const failures = [];
  const fail = (op, detail) =>
    failures.push(
      `${at} ${op}: got ${show(value)}${detail ? ` ${detail}` : ""}`,
    );

  for (const [op, expected] of Object.entries(predicate)) {
    switch (op) {
      case "pointer":
      case "note":
      case "flags":
        break;
      case "equals":
        if (!isDeepStrictEqual(value, expected))
          fail(op, `want ${show(expected)}`);
        break;
      case "matches":
        if (
          typeof value !== "string" ||
          !new RegExp(expected, predicate.flags ?? "").test(value)
        )
          fail(op, `want /${expected}/${predicate.flags ?? ""}`);
        break;
      case "contains":
        if (
          !(typeof value === "string" && value.includes(expected)) &&
          !(
            Array.isArray(value) &&
            value.some((v) => isDeepStrictEqual(v, expected))
          )
        )
          fail(op, `want ${show(expected)}`);
        break;
      case "containsAll":
        if (
          !Array.isArray(value) ||
          !expected.every((e) => value.some((v) => isDeepStrictEqual(v, e)))
        )
          fail(op, `want ${show(expected)}`);
        break;
      case "sameSet":
        if (!Array.isArray(value) || !sameSet(value, expected))
          fail(op, `want ${show(expected)}`);
        break;
      case "keys":
        if (
          !value ||
          typeof value !== "object" ||
          !sameSet(Object.keys(value), expected)
        )
          fail(op, `want keys ${show(expected)}`);
        break;
      case "length":
        if (!Array.isArray(value) || value.length !== expected)
          fail(op, `want ${expected}`);
        break;
      case "minLength":
        if (!Array.isArray(value) || value.length < expected)
          fail(op, `want at least ${expected}`);
        break;
      case "gt":
      case "gte":
      case "lt":
      case "lte":
        if (!compare(value, op, expected)) fail(op, `want ${op} ${expected}`);
        break;
      case "absent":
        if ((value === undefined) !== expected)
          fail(op, `want absent=${expected}`);
        break;
      case "every":
      case "some": {
        if (!Array.isArray(value)) {
          fail(op, "want an array");
          break;
        }
        const results = value.map((item, i) =>
          check(item, expected, `${at}/${i}`),
        );
        const held = results.filter((r) => r.length === 0).length;
        if (op === "every" && held !== value.length)
          failures.push(...results.flat().slice(0, 3));
        if (op === "some" && held === 0)
          fail(op, `no element meets ${show(expected)}`);
        break;
      }
      case "anyOf":
        if (!expected.some((p) => check(value, p, at).length === 0))
          fail(op, `meets none of ${show(expected)}`);
        break;
      case "allOf":
        for (const p of expected) failures.push(...check(value, p, at));
        break;
      case "rangeNumbers":
        if (!Array.isArray(value) || !sameSet(expandRanges(value), expected))
          fail(op, `want numbers ${show(expected)}`);
        break;
      case "centerX": {
        const centre = value?.x + value?.width / 2;
        failures.push(...check(centre, expected, `${at}.centerX`));
        break;
      }
      case "rectOverlap": {
        const overlap = rectOverlap(value, expected.rect);
        if (
          !overlap ||
          overlap.coverage < (expected.minCoverage ?? 0) ||
          overlap.iou < (expected.minIoU ?? 0)
        )
          fail(op, `overlap ${show(overlap)} want ${show(expected)}`);
        break;
      }
      default:
        throw new Error(`unknown predicate op ${op} at ${at}`);
    }
  }
  return failures;
}

export function resolve(root, pointer) {
  if (!pointer) return root;
  let value = root;
  for (const raw of pointer.split("/").slice(1)) {
    const token = raw.replaceAll("~1", "/").replaceAll("~0", "~");
    if (value == null) return undefined;
    if (Array.isArray(value) && /^-\d+$/.test(token))
      value = value.at(Number(token));
    else value = value[token];
  }
  return value;
}

function compare(value, op, expected) {
  if (typeof value !== "number") return false;
  if (op === "gt") return value > expected;
  if (op === "gte") return value >= expected;
  if (op === "lt") return value < expected;
  return value <= expected;
}

function sameSet(values, expected) {
  const a = new Set(values.map((v) => JSON.stringify(v)));
  const b = new Set(expected.map((v) => JSON.stringify(v)));
  return a.size === b.size && [...a].every((v) => b.has(v));
}

function expandRanges(ranges) {
  return ranges.flatMap(({ first, last }) =>
    Number.isInteger(first) && Number.isInteger(last) && last >= first
      ? Array.from({ length: last - first + 1 }, (_, i) => first + i)
      : [NaN],
  );
}

/** Share of the reference covered, and intersection over union. */
function rectOverlap(rect, reference) {
  if (
    !rect ||
    ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
  )
    return null;
  const w = Math.max(
    0,
    Math.min(reference.x + reference.width, rect.x + rect.width) -
      Math.max(reference.x, rect.x),
  );
  const h = Math.max(
    0,
    Math.min(reference.y + reference.height, rect.y + rect.height) -
      Math.max(reference.y, rect.y),
  );
  const intersection = w * h;
  const referenceArea = reference.width * reference.height;
  const union = referenceArea + rect.width * rect.height - intersection;
  return {
    coverage: Number((intersection / referenceArea).toFixed(3)),
    iou: Number((intersection / union).toFixed(3)),
  };
}

function show(value) {
  const text = JSON.stringify(value);
  return text === undefined
    ? "undefined"
    : text.length > 160
      ? `${text.slice(0, 157)}...`
      : text;
}
