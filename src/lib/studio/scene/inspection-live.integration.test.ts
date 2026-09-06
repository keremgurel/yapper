import { it, expect, vi } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";

// Auth/billing infrastructure is isolated; native composition, HTTP payloads,
// route validation, provider calls, repairs, persistence and export are real.
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "inspection-live-fixture" }),
}));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: async () => null,
  guardProviderSpend: async () => null,
}));
vi.mock("@/lib/billing/actions", () => ({
  preflightPaidActionOrResponse: async () => null,
  reservePaidActionOrResponse: async () => ({ reservation: {} }),
  refundCreditReservation: async () => {},
  PAID_ACTIONS: { design_overlay: { credits: 2 } },
}));
vi.mock("./brand-context", () => ({
  loadBrandContext: async () => ({
    palette: {
      primary: "#246BFE",
      secondary: "#163866",
      accent: "#246BFE",
      ink: "#ffffff",
      surface: "#111827",
      muted: "#b8c5d6",
    },
    logos: [],
    colors: [],
    hasKit: true,
  }),
}));
import { handleSceneRequest } from "./route-handler";
import { handleRenderedReview } from "./review-rendered";
vi.mock("./scene-model-call", async (original) => {
  const actual = await original<typeof import("./scene-model-call")>();
  return {
    ...actual,
    callSceneModel: async (
      input: import("./scene-model-call").SceneModelCall,
    ) => {
      const reply = await actual.callSceneModel(input);
      if (process.env.OVERLAY_INSPECTION_OUTPUT)
        await writeFile(
          `${process.env.OVERLAY_INSPECTION_OUTPUT}/${Date.now()}-model-reply.json`,
          JSON.stringify({ system: input.system.slice(0, 80), ...reply }),
        );
      return reply;
    },
  };
});

it.skipIf(process.env.RUN_OVERLAY_INSPECTION_LIVE !== "1")(
  "native create → real model → composited review/repair → save/export",
  async () => {
    loadEnvConfig(process.cwd());
    expect(process.env.SURPLUS_API_KEY).toBeTruthy();
    const output = process.env.OVERLAY_INSPECTION_OUTPUT!;
    expect(output).toBeTruthy();
    await mkdir(output, { recursive: true });
    if (process.env.OVERLAY_INSPECTION_REPLAY) {
      const request = new Request("http://localhost/review-overlay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: await readFile(process.env.OVERLAY_INSPECTION_REPLAY),
      });
      const response = await handleRenderedReview(request);
      await writeFile(`${output}/replay-response.json`, await response.text());
      expect(response.status).toBe(200);
      return;
    }
    let count = 0;
    const calls: string[] = [];
    const server = createServer(async (req, res) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const data = Buffer.concat(chunks);
        const path = req.url!.slice(1);
        calls.push(path);
        const index = ++count;
        await writeFile(`${output}/${index}-${path}-request.json`, data);
        const request = new Request(`http://localhost/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: data,
        });
        const response =
          path === "review-overlay"
            ? await handleRenderedReview(request)
            : await handleSceneRequest(
                request,
                path === "direct-overlays"
                  ? "direct"
                  : path === "design-overlays"
                    ? "design"
                    : "revise",
              );
        const answer = await response.text();
        await writeFile(`${output}/${index}-${path}-response.json`, answer);
        res
          .writeHead(response.status, { "content-type": "application/json" })
          .end(answer);
      } catch {
        res.writeHead(500).end('{"error":"fixture_server_failed"}');
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("no_address");
      const result = await promisify(execFile)(
        "swift",
        ["test", "--filter", "liveNativeCreationThroughBackendAndRealModel"],
        {
          cwd: "native-macos",
          timeout: 800_000,
          maxBuffer: 4 * 1024 * 1024,
          env: {
            ...process.env,
            OVERLAY_INSPECTION_ENDPOINT: `http://127.0.0.1:${address.port}`,
          },
        },
      );
      await writeFile(
        `${output}/native-test.log`,
        result.stdout + result.stderr,
      );
      if (
        !process.env.OVERLAY_INSPECTION_REAL_PROJECT &&
        !process.env.OVERLAY_INSPECTION_BROKEN
      ) {
        expect(calls).toContain("direct-overlays");
        expect(calls).toContain("design-overlays");
      }
      expect(calls).toContain("review-overlay");
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },
  850_000,
);
