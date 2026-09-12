import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { planChirpy } from "./planner";
import type { PlanInput } from "./protocol";
import contract from "../../../protocol/app-actions.schema.json";

const projectID = randomUUID(),
  sessionID = randomUUID();
const overlayID = "1385EF9B-98A4-4480-B58F-954A2685609B";
const context = {
  projectID,
  sessionID,
  revision: 1,
  duration: 90,
  playhead: 9,
  reveals: [
    {
      overlayID,
      name: "Google Ads spoken reveal",
      regions: [
        { id: "number-0", label: "Clicks", text: "34", policy: "untilCue" },
        {
          id: "number-1",
          label: "Impressions",
          text: "291",
          policy: "alwaysHidden",
        },
        {
          id: "number-2",
          label: "Avg. CPC",
          text: "CA$1.10",
          policy: "alwaysHidden",
        },
        { id: "number-3", label: "Cost", text: "CA$37.47", policy: "untilCue" },
      ],
    },
  ],
  revealEvents: [
    {
      id: `${overlayID}/number-3`,
      overlayID,
      regionID: "number-3",
      label: "Cost",
      text: "CA$37.47",
      timelineTime: 6.524,
    },
    {
      id: `${overlayID}/number-0`,
      overlayID,
      regionID: "number-0",
      label: "Clicks",
      text: "34",
      timelineTime: 8.249,
    },
  ],
  soundLibrary: [{ id: "mouse-click", name: "Mouse click" }],
  sounds: [],
  selectedOverlayID: overlayID,
};
function input(messages: PlanInput["messages"]): PlanInput {
  return {
    protocolVersion: 1,
    projectID,
    sessionID,
    executionID: randomUUID(),
    revision: 1,
    context,
    catalog: contract["x-actions"],
    messages,
  };
}
it.skipIf(process.env.RUN_CHIRPY_EVAL !== "1")(
  "interprets the reported masking correction without touching cost or clicks",
  async () => {
    const reply = await planChirpy(
      input([
        {
          role: "user",
          content:
            "well i still see the google ads overlay hide the impression and cpc. Keep those visible at all times.",
        },
      ]),
    );
    expect(reply.actions).toHaveLength(1);
    expect(reply.actions[0].action).toBe("editor.reveals.setPolicy");
    expect(reply.actions[0].arguments.overlayID).toBe(overlayID);
    expect(reply.actions[0].arguments.regions).toEqual(
      expect.arrayContaining([
        { regionID: "number-1", policy: "alwaysVisible" },
        { regionID: "number-2", policy: "alwaysVisible" },
      ]),
    );
    expect(reply.actions[0].arguments.regions).toHaveLength(2);
  },
  50_000,
);
it.skipIf(process.env.RUN_CHIRPY_EVAL !== "1")(
  "binds the exact sound request to saved click and cost reveals",
  async () => {
    const reply = await planChirpy(
      input([
        {
          role: "user",
          content: "add click sound effects when we reveal the clicks and cost",
        },
      ]),
    );
    expect(reply.actions).toEqual([
      {
        action: "editor.sounds.addAtReveals",
        arguments: {
          effectID: "mouse-click",
          eventIDs: expect.arrayContaining(
            context.revealEvents.map((event) => event.id),
          ),
        },
      },
    ]);
    expect(reply.actions[0].arguments.eventIDs).toHaveLength(2);
  },
  50_000,
);
it.skipIf(process.env.RUN_CHIRPY_EVAL !== "1")(
  "resolves a follow-up using the previous exchange",
  async () => {
    const reply = await planChirpy(
      input([
        {
          role: "user",
          content:
            "The clicks and cost are the two numbers that reveal as I speak.",
        },
        {
          role: "assistant",
          content:
            "Clicks reveal at 8.249s and cost at 6.524s in the saved scene.",
        },
        { role: "user", content: "Put a click sound on those two reveals." },
      ]),
    );
    expect(reply.actions.map((action) => action.action)).toEqual([
      "editor.sounds.addAtReveals",
    ]);
    expect(reply.actions[0].arguments.eventIDs).toEqual(
      expect.arrayContaining(context.revealEvents.map((event) => event.id)),
    );
  },
  50_000,
);
it.skipIf(!process.env.CHIRPY_QA_CONTEXT)(
  "plans the sound request from captured native project context",
  async () => {
    const { readFile, writeFile } = await import("node:fs/promises");
    const { parsePlanInput } = await import("./protocol");
    const captured = parsePlanInput(
      JSON.parse(await readFile(process.env.CHIRPY_QA_CONTEXT!, "utf8")),
    );
    expect(captured).not.toBeNull();
    const reply = await planChirpy(captured!);
    expect(reply.actions).toHaveLength(1);
    expect(reply.actions[0].action).toBe("editor.sounds.addAtReveals");
    expect(reply.actions[0].arguments.effectID).toBe("mouse-click");
    expect(reply.actions[0].arguments.eventIDs).toHaveLength(2);
    if (process.env.CHIRPY_QA_PLAN)
      await writeFile(
        process.env.CHIRPY_QA_PLAN,
        JSON.stringify(reply, null, 2),
      );
  },
  50_000,
);

it.skipIf(process.env.RUN_CHIRPY_EVAL !== "1")(
  "zooms into a named metric using the registered crop action and saved region",
  async () => {
    const request = input([
      {
        role: "user",
        content:
          "Zoom into Cost on the Google Ads overlay from 1 to 2 seconds into the overlay, hold it, then zoom back out from 4 to 5 seconds. Keep all masks unchanged.",
      },
    ]);
    request.context = {
      ...context,
      overlays: [{ id: overlayID, timelineStart: 3.668, duration: 6 }],
      reveals: [
        {
          overlayID,
          name: "Google Ads",
          regions: [
            {
              id: "number-3",
              label: "Cost",
              text: "CA$37.47",
              box: [
                [0.75, 0.4],
                [0.2, 0.25],
              ],
            },
          ],
        },
      ],
    };
    const reply = await planChirpy(request);
    expect(reply.actions).toHaveLength(1);
    expect(reply.actions[0].action).toBe("editor.overlays.zoom");
    expect(reply.actions[0].arguments).toMatchObject({
      overlayID,
      startTime: 1,
      endTime: 2,
      returnStart: 4,
      returnEnd: 5,
    });
    const target = reply.actions[0].arguments.target as {
      x: number;
      width: number;
    };
    expect(target.x + target.width / 2).toBeGreaterThan(0.7);
  },
  50_000,
);
