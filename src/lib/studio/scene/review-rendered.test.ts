import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  ingress: vi.fn(),
  spend: vi.fn(),
  model: vi.fn(),
  design: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: mocks.ingress,
  guardProviderSpend: mocks.spend,
}));
vi.mock("./scene-model-call", () => ({
  callSceneModel: mocks.model,
  sceneModelFailureReason: () => "ai_failed",
}));
vi.mock("./design-checked", () => ({ designChecked: mocks.design }));
vi.mock("./brand-context", () => ({
  loadBrandContext: async () => ({
    palette: {},
    logos: [],
    colors: [],
    hasKit: false,
  }),
}));
import { handleRenderedReview, parseRenderedReview } from "./review-rendered";

const scene = {
  version: 1,
  duration: 2,
  nodes: [
    {
      id: "card",
      type: "rect",
      x: 0.5,
      y: 0.5,
      width: 1,
      height: 1,
      fill: "#0000ff",
    },
  ],
  animations: [],
};
const body = {
  op: "restyle",
  instruction: "Show growth",
  repair: true,
  timelineStart: 2,
  sourceStart: 0,
  visibleDuration: 2,
  placement: { x: 0.1, y: 0.1, width: 0.6, height: 0.3 },
  renderPalette: {
    primary: "#FF6622",
    secondary: "#000000",
    accent: "#FF6622",
    ink: "#000000",
    surface: "#FFFFFF",
    muted: "#777777",
  },
  duration: 2,
  frameAspect: 1.6,
  frameHeightPx: 1080,
  box: { aspect: 1.6, widthPx: 640, heightPx: 400 },
  asset: { name: "Growth", scene },
  inspection: {
    frames: [{ at: 3, jpeg: "/9j/AA==" }],
    words: [],
    waveform: [],
  },
};
const request = (value: unknown = body) =>
  new Request("https://ypr.app/api/review-overlay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user" });
  mocks.ingress.mockResolvedValue(null);
  mocks.spend.mockResolvedValue(null);
  mocks.model.mockResolvedValue({ content: '{"passed":true,"issues":[]}' });
  mocks.design.mockResolvedValue(JSON.stringify({ scene, images: [] }));
});
it("passes only a consistent explicit verdict", () => {
  for (const value of [
    { passed: true, issues: ["clipped"] },
    { passed: false, issues: [] },
    { passed: "true", issues: [] },
    {},
  ])
    expect(parseRenderedReview(JSON.stringify(value))).toBeNull();
});
it("accepts a detailed timing defect without misclassifying the review as unreadable", () => {
  const issue =
    "The count starts before the earlier figures finish being spoken. ".repeat(
      8,
    );
  expect(
    parseRenderedReview(JSON.stringify({ passed: false, issues: [issue] })),
  ).toEqual({ passed: false, issues: [issue] });
});
it("requires authentication and valid bounded evidence before spending", async () => {
  mocks.auth.mockResolvedValueOnce({ userId: null });
  expect((await handleRenderedReview(request())).status).toBe(401);
  expect(
    (await handleRenderedReview(request({ ...body, inspection: {} }))).status,
  ).toBe(400);
  expect(mocks.model).not.toHaveBeenCalled();
});
it("sends actual images and uses the dedicated QA rate budget", async () => {
  const response = await handleRenderedReview(request());
  expect(await response.json()).toEqual({ passed: true, issues: [] });
  expect(mocks.model.mock.calls[0][0].images).toEqual(["/9j/AA=="]);
  expect(mocks.spend.mock.calls[0][2]).toBe("review-overlay");
  expect(mocks.design).not.toHaveBeenCalled();
});
it("does not call a provider after rate limiting or an oversized request", async () => {
  mocks.spend.mockResolvedValueOnce(
    Response.json({ error: "rate_limited" }, { status: 429 }),
  );
  expect((await handleRenderedReview(request())).status).toBe(429);
  expect(
    (
      await handleRenderedReview(
        request({ ...body, padding: "x".repeat(3 * 1024 * 1024) }),
      )
    ).status,
  ).toBe(413);
  expect(mocks.model).not.toHaveBeenCalled();
});
it("returns a repaired draft without claiming that draft passed", async () => {
  mocks.model.mockResolvedValue({
    content: '{"passed":false,"issues":["Label is clipped at 3s"]}',
  });
  const response = await handleRenderedReview(request());
  const result = await response.json();
  expect(result.passed).toBe(false);
  expect(result.repaired.scene.nodes).toHaveLength(1);
  expect(mocks.design.mock.calls[0][0].images).toEqual(["/9j/AA=="]);
  expect(mocks.design.mock.calls[0][0].user).toContain("primary #FF6622");
});
it("does not repair after the client budget is exhausted", async () => {
  mocks.model.mockResolvedValue({
    content: '{"passed":false,"issues":["Clipped"]}',
  });
  const response = await handleRenderedReview(
    request({ ...body, repair: false }),
  );
  expect(await response.json()).toEqual({ passed: false, issues: ["Clipped"] });
  expect(mocks.design).not.toHaveBeenCalled();
});
it("fails closed on malformed model verdicts and refuses new paid images in repairs", async () => {
  mocks.model.mockResolvedValueOnce({
    content: '{"passed":true,"issues":["Clipped"]}',
  });
  expect((await handleRenderedReview(request())).status).toBe(502);
  mocks.model.mockResolvedValue({
    content: '{"passed":false,"issues":["Clipped"]}',
  });
  mocks.design.mockResolvedValue(
    JSON.stringify({ scene, images: [{ key: "new", prompt: "A picture" }] }),
  );
  expect((await handleRenderedReview(request())).status).toBe(502);
});
