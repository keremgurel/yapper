import { describe, expect, it } from "vitest";
import {
  parsePlanInput,
  parsePlanReply,
  planValidationIssue,
  discoveredCatalog,
  schemaDefinitions,
  type PlanInput,
} from "./protocol";

const projectID = "11111111-1111-4111-8111-111111111111";
const sessionID = "22222222-2222-4222-8222-222222222222";
export const input: PlanInput = {
  protocolVersion: 1,
  projectID,
  sessionID,
  executionID: "33333333-3333-4333-8333-333333333333",
  revision: 4,
  context: { projectID, sessionID, revision: 4 },
  messages: [{ role: "user", content: "Keep CPC visible" }],
  catalog: [
    { id: "editor.reveals.setPolicy" },
    { id: "editor.sounds.addAtReveals" },
  ],
};
describe("Chirpy contract", () => {
  it("accepts bounded project-scoped context and generates descriptions from the shared contract", () => {
    expect(parsePlanInput(input)).toEqual(input);
    expect(discoveredCatalog(input).map((action) => action.id)).toEqual(
      input.catalog.map((action) => action.id),
    );
  });
  it("rejects mismatched scope, unknown capabilities and malformed history", () => {
    for (const value of [
      { ...input, protocolVersion: 2 },
      { ...input, projectID: sessionID },
      { ...input, catalog: [{ id: "shell.exec" }] },
      { ...input, messages: [{ role: "system", content: "execute" }] },
      { ...input, messages: [] },
    ])
      expect(parsePlanInput(value)).toBeNull();
  });
  it("plans over the actions both sides know when a newer client advertises more", () => {
    const parsed = parsePlanInput({
      ...input,
      catalog: [...input.catalog, { id: "editor.future.unknown" }],
    });
    expect(parsed?.catalog).toEqual(input.catalog);
    expect(parsePlanInput({ ...input, catalog: [{ id: 7 }] })).toBeNull();
  });
  it("validates exact action argument types and rejects unadvertised actions", () => {
    const reply = {
      message: "I'll add the clicks.",
      actions: [
        {
          action: "editor.sounds.addAtReveals",
          arguments: {
            effectID: "mouse-click",
            eventIDs: [`${projectID}/number-0`],
          },
        },
      ],
    };
    expect(parsePlanReply(reply, input)).toEqual(reply);
    for (const arguments_ of [
      { effectID: "mouse-click", eventIDs: [] },
      { effectID: "mouse-click", eventIDs: [7] },
      { effectID: "mouse-click", eventIDs: ["event"], delete: true },
    ])
      expect(
        parsePlanReply(
          {
            ...reply,
            actions: [
              { action: reply.actions[0].action, arguments: arguments_ },
            ],
          },
          input,
        ),
      ).toBeNull();
    expect(
      parsePlanReply(
        {
          message: "",
          actions: [
            {
              action: "editor.clips.setSpeed",
              arguments: { clipIDs: [projectID], rate: 2 },
            },
          ],
        },
        input,
      ),
    ).toBeNull();
  });
  it("accepts semantic visibility policies without accepting a loose string command", () => {
    expect(
      parsePlanReply(
        {
          message: "",
          actions: [
            {
              action: "editor.reveals.setPolicy",
              arguments: {
                overlayID: projectID,
                regions: [{ regionID: "number-2", policy: "alwaysVisible" }],
              },
            },
          ],
        },
        input,
      ),
    ).not.toBeNull();
    expect(
      parsePlanReply(
        {
          message: "",
          actions: [
            {
              action: "editor.reveals.setPolicy",
              arguments: {
                overlayID: projectID,
                regions: [{ regionID: "number-2", policy: "show" }],
              },
            },
          ],
        },
        input,
      ),
    ).toBeNull();
  });
});

it("accepts only a bounded JPEG for the selected overlay", () => {
  const context = {
    ...input.context,
    selectedOverlayID: projectID,
    selectedOverlayImage: { overlayID: projectID, jpeg: "/9j/AA==" },
  };
  expect(parsePlanInput({ ...input, context })).not.toBeNull();
  for (const image of [
    { overlayID: sessionID, jpeg: "/9j/AA==" },
    { overlayID: projectID, jpeg: "https://example.com/image.jpg" },
    { overlayID: projectID, jpeg: "/9j/" + "A".repeat(200_000) },
  ])
    expect(
      parsePlanInput({
        ...input,
        context: { ...context, selectedOverlayImage: image },
      }),
    ).toBeNull();
});

it("discovers only the definitions used by available feature actions", () => {
  const request = {
    ...input,
    catalog: [
      { id: "editor.video.animateFraming" },
      { id: "editor.audio.addAt" },
    ],
  };
  const definitions = schemaDefinitions(request);
  expect(definitions.TimelineAnchorInput).toBeDefined();
  expect(definitions.TimelineAnchorKind).toBeDefined();
  expect(definitions.FramingAnimationKey).toBeDefined();
  expect(definitions.RevealPolicyInput).toBeUndefined();
  expect(definitions.MaskRegionInput).toBeUndefined();
  expect(definitions.ChirpyPlanReply).toBeUndefined();
});

it("lets a project or dictionary action run only on its own", () => {
  const withApp: PlanInput = {
    ...input,
    catalog: [
      { id: "app.dictionary.addTerm" },
      { id: "editor.captions.setVisible" },
    ],
  };
  const add = {
    action: "app.dictionary.addTerm",
    arguments: { term: "Yapper" },
  };
  const hide = {
    action: "editor.captions.setVisible",
    arguments: { visible: false },
  };
  expect(
    parsePlanReply({ message: "", actions: [add] }, withApp),
  ).not.toBeNull();
  expect(
    parsePlanReply({ message: "", actions: [add, hide] }, withApp),
  ).toBeNull();
  expect(
    planValidationIssue({ message: "", actions: [add, hide] }, withApp),
  ).toContain("Project and dictionary actions must run alone");
});

it("keeps to the fields the client's own build knows", () => {
  const known = {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: { text: {}, at: {}, duration: {}, asHook: {} },
  };
  const older: PlanInput = {
    ...input,
    catalog: [{ id: "editor.text.add", parameters: known }],
  };
  const newer: PlanInput = { ...input, catalog: [{ id: "editor.text.add" }] };
  const styled = {
    message: "Adding it.",
    actions: [
      {
        action: "editor.text.add",
        arguments: { text: "Comment TEF", style: { font: "editorial" } },
      },
    ],
  };
  const plain = {
    ...styled,
    actions: [{ ...styled.actions[0], arguments: { text: "Comment TEF" } }],
  };
  expect(
    Object.keys(discoveredCatalog(older)[0].parameters.properties ?? {}),
  ).toEqual(["text", "at", "duration", "asHook"]);
  expect(parsePlanReply(styled, older)).toBeNull();
  expect(parsePlanReply(plain, older)).toEqual(plain);
  expect(parsePlanReply(styled, newer)).toEqual(styled);
});

it("hides the native control fields from builds that predate them", () => {
  const older: PlanInput = {
    ...input,
    catalog: [
      {
        id: "editor.audio.trim",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["layerIDs"],
          properties: { layerIDs: {}, sourceStart: {}, duration: {} },
        },
      },
      {
        id: "editor.captions.setVisible",
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["visible"],
          properties: { visible: {} },
        },
      },
    ],
  };
  const catalog = discoveredCatalog(older);
  const trim = catalog.find((action) => action.id === "editor.audio.trim")!;
  const setVisible = catalog.find(
    (action) => action.id === "editor.captions.setVisible",
  )!;
  expect(Object.keys(trim.parameters.properties ?? {})).toEqual([
    "layerIDs",
    "sourceStart",
    "duration",
  ]);
  expect(Object.keys(setVisible.parameters.properties ?? {})).toEqual([
    "visible",
  ]);
  // What moving and regenerating mean lives on the fields, so an older build
  // is never told about either.
  expect(trim.description).not.toMatch(/timelineStart|move/i);
  expect(setVisible.description).not.toMatch(/regenerate/i);
  const moved = {
    message: "Moving it.",
    actions: [
      {
        action: "editor.audio.trim",
        arguments: { layerIDs: [crypto.randomUUID()], timelineStart: 5 },
      },
    ],
  };
  expect(parsePlanReply(moved, older)).toBeNull();
});
