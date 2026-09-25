import { describe, expect, it } from "vitest";
import {
  formatServerTiming,
  startSpan,
  withServerTiming,
} from "./server-timing";

describe("withServerTiming", () => {
  it("adds total and recorded spans to the handler's response", async () => {
    const GET = withServerTiming(async (label: string) => {
      startSpan("db")?.();
      startSpan("db")?.();
      return Response.json({ label });
    });

    const response = await GET("ok");
    const header = response.headers.get("Server-Timing") ?? "";
    expect(header).toMatch(/^total;dur=\d+\.\d/);
    expect(header).toMatch(/db;dur=\d+\.\d;desc="2"/);
    await expect(response.json()).resolves.toEqual({ label: "ok" });
  });

  it("keeps concurrent requests' spans apart", async () => {
    const GET = withServerTiming(async (queries: number) => {
      for (let i = 0; i < queries; i++) {
        const stop = startSpan("db");
        await new Promise((resolve) => setTimeout(resolve, 1));
        stop?.();
      }
      return new Response("ok");
    });

    const [one, three] = await Promise.all([GET(1), GET(3)]);
    expect(one.headers.get("Server-Timing")).toContain('desc="1"');
    expect(three.headers.get("Server-Timing")).toContain('desc="3"');
  });

  it("still times responses whose headers are immutable", async () => {
    const GET = withServerTiming(async () =>
      Response.redirect("https://ypr.app/", 302),
    );
    const response = await GET();
    expect(response.status).toBe(302);
    expect(response.headers.get("Server-Timing")).toMatch(/^total;dur=/);
  });

  it("records nothing outside a timed request", () => {
    expect(startSpan("db")).toBeNull();
  });
});

describe("formatServerTiming", () => {
  it("lists total first, then each span with its count", () => {
    expect(
      formatServerTiming(12.34, new Map([["db", { ms: 3.21, count: 2 }]])),
    ).toBe('total;dur=12.3, db;dur=3.2;desc="2"');
  });
});
