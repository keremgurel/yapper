import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./env.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load eval cases. Each JSON file in cases/ is one case:
 *
 *   id, from (the integration test it was ported from), tags (`safety`
 *   marks the safety set), catalog ("legacy-client" | "current"),
 *   base (a bases/*.json context), context (merged over the base),
 *   replaceContext, append (arrays concatenated onto the base), files
 *   (pointer into context -> file read as base64), payload (a captured
 *   CHIRPY_QA_CONTEXT file, `$NAME` reads an env var), requiresEnv,
 *   messages, expect (see score.mjs).
 *
 * `build()` returns a fresh PlanInput for one attempt. Project and session
 * IDs are new each time, so repeated runs share only what production turns
 * share (the static prompt), not a whole identical request.
 */
export async function loadCases({ only, tags, payloads = [] } = {}) {
  const contract = JSON.parse(
    await fs.readFile(
      path.join(ROOT, "protocol/app-actions.schema.json"),
      "utf8",
    ),
  );
  const dir = path.join(HERE, "cases");
  const files = (await fs.readdir(dir))
    .filter((f) => f.endsWith(".json"))
    .sort();
  const specs = [];
  for (const file of files)
    specs.push({
      ...JSON.parse(await fs.readFile(path.join(dir, file), "utf8")),
      file: path.join(dir, file),
    });
  for (const file of payloads) specs.push(await payloadSpec(file));

  const cases = [];
  const skipped = [];
  for (const spec of specs) {
    if (only?.length && !only.includes(spec.id)) continue;
    if (tags?.length && !tags.some((tag) => spec.tags?.includes(tag))) continue;
    const missing = (spec.requiresEnv ?? []).filter(
      (name) => !process.env[name],
    );
    if (missing.length) {
      skipped.push(`${spec.id} (needs ${missing.join(", ")})`);
      continue;
    }
    cases.push(await prepare(spec, contract));
  }
  return { cases, skipped };
}

async function prepare(spec, contract) {
  const catalog = catalogFor(spec.catalog, contract);
  let template;
  if (spec.payload) {
    const file = expandEnv(spec.payload);
    template = JSON.parse(
      await fs.readFile(path.resolve(path.dirname(spec.file), file), "utf8"),
    );
  } else {
    const base = spec.base
      ? JSON.parse(
          await fs.readFile(
            path.join(HERE, "bases", `${spec.base}.json`),
            "utf8",
          ),
        ).context
      : {};
    const context = spec.replaceContext
      ? { ...spec.context }
      : { ...base, ...spec.context };
    for (const [key, items] of Object.entries(spec.append ?? {}))
      context[key] = [...(context[key] ?? []), ...items];
    for (const [pointer, file] of Object.entries(spec.files ?? {}))
      setAt(
        context,
        pointer,
        (
          await fs.readFile(path.resolve(path.dirname(spec.file), file))
        ).toString("base64"),
      );
    template = {
      protocolVersion: 1,
      revision: 1,
      context,
      catalog,
      messages: spec.messages,
    };
  }
  if (spec.messages) template.messages = spec.messages;
  if (!spec.payload || spec.catalog) template.catalog = catalog;
  return {
    id: spec.id,
    from: spec.from ?? null,
    tags: spec.tags ?? [],
    safety: (spec.tags ?? []).includes("safety"),
    expect: spec.expect ?? {},
    build: () => freshInput(template),
  };
}

/** New project, session and execution IDs, placed first like the native context. */
function freshInput(template) {
  const projectID = randomUUID();
  const sessionID = randomUUID();
  const revision = template.revision ?? template.context.revision ?? 1;
  const context = structuredClone(template.context);
  delete context.projectID;
  delete context.sessionID;
  delete context.revision;
  return {
    protocolVersion: 1,
    executionID: randomUUID(),
    projectID,
    sessionID,
    revision,
    context: { projectID, sessionID, revision, ...context },
    catalog: structuredClone(template.catalog),
    messages: structuredClone(template.messages),
  };
}

/**
 * "legacy-client" is the catalog the first integration tests used: an older
 * build that did not advertise four newer actions. "current" is every
 * non-legacy action, what today's Mac app sends.
 */
function catalogFor(name = "current", contract) {
  const actions = contract["x-actions"];
  if (name === "legacy-client") {
    const newer = new Set([
      "editor.video.animateFraming",
      "editor.audio.addAt",
      "editor.masks.setRegion",
      "editor.masks.remove",
    ]);
    return actions.filter((a) => !newer.has(a.id)).map((a) => ({ id: a.id }));
  }
  if (name === "current")
    return actions.filter((a) => !a.legacy).map((a) => ({ id: a.id }));
  throw new Error(`unknown catalog ${name}`);
}

/** An ad hoc case from a captured payload; expectations from a sibling .expect.json. */
async function payloadSpec(file) {
  const resolved = path.resolve(file);
  const expectFile = resolved.replace(/\.json$/, ".expect.json");
  const expect = await fs
    .readFile(expectFile, "utf8")
    .then((text) => JSON.parse(text))
    .catch(() => ({}));
  return {
    id: `payload:${path.basename(resolved, ".json")}`,
    tags: ["captured"],
    payload: resolved,
    file: resolved,
    expect,
  };
}

function expandEnv(value) {
  return value.replace(/^\$([A-Z0-9_]+)/, (_, name) => process.env[name] ?? "");
}

function setAt(target, pointer, value) {
  const keys = pointer.split("/").slice(1);
  let node = target;
  for (const key of keys.slice(0, -1)) node = node[key] ??= {};
  node[keys.at(-1)] = value;
}
