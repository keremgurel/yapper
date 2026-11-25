import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { parseStudioPlan, studioCatalog } from "@/lib/chirpy/studio/catalog";
import { STUDIO_EXECUTORS } from "@/lib/chirpy/studio/actions";
import {
  readStylesOverview,
  wantsStyles,
} from "@/lib/chirpy/studio/styles/reads";
import * as schema from "@/lib/db/schema";
import { handleMcpMessage } from "./json-rpc";
import { offeredActions } from "./offered-actions";

// A connector session end to end against PostgreSQL with the real migration:
// the tools it is offered, a look saved and edited through Chirpy's own
// executors, and one account never reaching another's looks.
const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));

const request = new Request("http://localhost/api/mcp");
const creator = { userId: "creator", request };
const other = { userId: "other", request };
let nextId = 1;

async function rpc(
  caller: typeof creator,
  method: string,
  params?: Record<string, unknown>,
) {
  const reply = await handleMcpMessage(caller, {
    jsonrpc: "2.0",
    id: nextId++,
    method,
    params,
  });
  if (!reply || "error" in reply) throw new Error(JSON.stringify(reply));
  return reply.result as Record<string, unknown>;
}

async function call(
  caller: typeof creator,
  name: string,
  args: Record<string, unknown> = {},
) {
  const result = await rpc(caller, "tools/call", { name, arguments: args });
  return result as {
    content: { text: string }[];
    structuredContent?: Record<string, unknown>;
    isError: boolean;
  };
}

type Place = {
  path: string;
  block: { styleId: string; options: { key: string; value: unknown }[] } | null;
};
const places = (result: { structuredContent?: Record<string, unknown> }) =>
  result.structuredContent?.places as Place[];
const optionAt = (list: Place[], path: string, key: string) =>
  list
    .find((place) => place.path === path)
    ?.block?.options.find((o) => o.key === key)?.value;

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30_000);
beforeEach(async () => {
  await client.exec("TRUNCATE users CASCADE");
  await db.insert(schema.users).values([{ id: "creator" }, { id: "other" }]);
});
afterAll(async () => {
  await client.close();
});

describe("what a connector is offered", () => {
  it("is a filter over Chirpy's contract, with nothing that asks first or spends", () => {
    const offered = offeredActions().map((action) => action.id);
    expect(offered).toEqual(["studio.styles.edit", "studio.styles.save"]);
    for (const id of offered) expect(STUDIO_EXECUTORS).toHaveProperty([id]);
    const catalog = studioCatalog().map((action) => action.id);
    for (const id of offered) expect(catalog).toContain(id);
  });

  it("answers the handshake and lists tools with self-contained schemas", async () => {
    const hello = await rpc(creator, "initialize", {
      protocolVersion: "2025-03-26",
    });
    expect(hello).toMatchObject({
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
    });

    const { tools } = (await rpc(creator, "tools/list")) as {
      tools: {
        name: string;
        inputSchema: unknown;
        annotations: { readOnlyHint: boolean };
      }[];
    };
    expect(tools.map((tool) => tool.name)).toEqual([
      "studio_styles_context",
      "studio_styles_describe_look",
      "studio_styles_edit",
      "studio_styles_save",
    ]);
    expect(JSON.stringify(tools)).not.toContain("$ref");
    expect(
      tools
        .filter((tool) => tool.annotations.readOnlyHint)
        .map((tool) => tool.name),
    ).toEqual(["studio_styles_context", "studio_styles_describe_look"]);
  });

  it("acknowledges a notification without a reply and rejects an unknown method", async () => {
    expect(
      await handleMcpMessage(creator, {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    ).toBeNull();
    expect(
      await handleMcpMessage(creator, {
        jsonrpc: "2.0",
        id: 1,
        method: "resources/list",
      }),
    ).toMatchObject({ error: { code: -32601 } });
  });
});

describe("a connector session", () => {
  it("reads the library, saves a look and changes its background, top visual and captions", async () => {
    const context = await call(creator, "studio_styles_context");
    expect(context.structuredContent).toMatchObject({ looks: [] });
    expect(JSON.stringify(context.structuredContent)).toContain(
      "half-and-half",
    );

    const saved = await call(creator, "studio_styles_save", {
      from: "half-and-half",
      name: "Demo days",
    });
    expect(saved.isError).toBe(false);
    expect(saved.content[0].text).toContain("Saved “Demo days” to your looks.");
    const lookID = saved.structuredContent?.id as string;
    // The library's sample picture is not copied into a creator's look.
    const savedText = JSON.stringify(saved.structuredContent);
    expect(savedText).not.toContain("data:image");
    expect(savedText).not.toContain("style-samples");

    const edited = await call(creator, "studio_styles_edit", {
      lookID,
      edits: [
        {
          op: "setOptions",
          at: "layout",
          options: { backdrop: "color", backdropColor: "#1e3a8a" },
        },
        {
          op: "setContent",
          at: "layout.top",
          content: { src: "https://example.com/chart.png" },
        },
        {
          op: "setOptions",
          at: "captions",
          options: { color: "#FFD93D", fontSize: 400 },
        },
      ],
    });
    expect(edited.isError).toBe(false);
    expect(edited.content[0].text).toContain("Moved 'fontSize' from 400 to 84");

    const described = await call(creator, "studio_styles_describe_look", {
      lookID,
    });
    const now = places(described);
    expect(optionAt(now, "layout", "backdropColor")).toBe("#1E3A8A");
    expect(optionAt(now, "captions", "color")).toBe("#FFD93D");
    expect(optionAt(now, "captions", "fontSize")).toBe(84);

    const overview = await readStylesOverview("creator");
    expect(overview.looks).toEqual([
      {
        id: lookID,
        name: "Demo days",
        places: [
          {
            at: "layout",
            block: "splits.half-and-half",
            options: { backdrop: "color", backdropColor: "#1E3A8A" },
          },
          { at: "layout.top", block: "overlays.media" },
          { at: "overlay", block: null },
          {
            at: "captions",
            block: "captions.plain-white",
            options: { color: "#FFD93D", fontSize: 84 },
          },
        ],
      },
    ]);
  });

  it("changes nothing when one edit in a batch is refused, and says what would work", async () => {
    const saved = await call(creator, "studio_styles_save", {
      from: "speaker-below",
    });
    const lookID = saved.structuredContent?.id as string;
    const refused = await call(creator, "studio_styles_edit", {
      lookID,
      edits: [
        { op: "setOptions", at: "layout", options: { backdrop: "dots" } },
        { op: "setBlock", at: "captions", styleId: "cards.smoked-glass" },
      ],
    });
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toContain("Edit 2:");
    expect(refused.content[0].text).toContain("captions.plain-white");
    const after = await call(creator, "studio_styles_describe_look", {
      lookID,
    });
    expect(optionAt(places(after), "layout", "backdrop")).toBe("frosted");
  });

  it("refuses arguments the contract does not allow before anything runs", async () => {
    const result = await call(creator, "studio_styles_save", {
      from: "half-and-half",
      colour: "red",
    });
    expect(result.isError).toBe(true);
    expect((await readStylesOverview("creator")).looks).toEqual([]);
  });

  it("names the templates when asked to start from one that does not exist", async () => {
    const result = await call(creator, "studio_styles_save", {
      from: "sideways",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(
      "talking-head, half-and-half, speaker-below",
    );
  });

  it("keeps one account out of another's looks", async () => {
    const saved = await call(creator, "studio_styles_save", {
      from: "talking-head",
    });
    const lookID = saved.structuredContent?.id as string;
    expect(
      (await call(other, "studio_styles_describe_look", { lookID })).isError,
    ).toBe(true);
    expect(
      (await call(other, "studio_styles_edit", { lookID, name: "Mine now" }))
        .isError,
    ).toBe(true);
    expect(
      (await call(other, "studio_styles_save", { from: lookID })).isError,
    ).toBe(true);
    expect((await readStylesOverview("other")).looks).toEqual([]);
  });

  it("does not offer deleting, which asks the creator first in the app", async () => {
    const reply = await handleMcpMessage(creator, {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "studio_styles_delete", arguments: {} },
    });
    expect(reply).toMatchObject({ error: { code: -32602 } });
  });
});

describe("Chirpy's side of the same actions", () => {
  it("accepts a plan that edits a look, checked by the same schema", () => {
    const plan = {
      message: "Changed the background to navy.",
      actions: [
        {
          action: "studio.styles.edit",
          arguments: {
            lookID: "7f3f8a5e-0c1b-4b7e-9a51-2f0d4c6b8e11",
            edits: [
              {
                op: "setOptions",
                at: "layout",
                options: { backdrop: "color" },
              },
            ],
          },
        },
      ],
    };
    expect(parseStudioPlan(plan)).not.toBeNull();
    expect(
      parseStudioPlan({
        ...plan,
        actions: [
          { ...plan.actions[0], arguments: { lookID: "nope", edits: [] } },
        ],
      }),
    ).toBeNull();
  });

  it("reads the library only when the request is about looks", () => {
    expect(
      wantsStyles("/studio/ideas", "make my saved look use a navy backdrop"),
    ).toBe(true);
    expect(
      wantsStyles(
        "/studio/ideas",
        "start a new look from the half-and-half template",
      ),
    ).toBe(true);
    expect(wantsStyles("/studio/ideas", "look at my ideas for next week")).toBe(
      false,
    );
    expect(
      wantsStyles("/studio/ideas", "what style of hook works for gym videos"),
    ).toBe(false);
  });
});
