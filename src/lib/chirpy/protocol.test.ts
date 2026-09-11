import { describe, expect, it } from "vitest";
import {
  parsePlanInput,
  parsePlanReply,
  discoveredCatalog,
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
