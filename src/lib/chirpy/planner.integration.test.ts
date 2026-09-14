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
    catalog: contract["x-actions"].filter(
      (action) =>
        ![
          "editor.video.animateFraming",
          "editor.audio.addAt",
          "editor.masks.setRegion",
          "editor.masks.remove",
        ].includes(action.id),
    ),
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

it.skipIf(process.env.RUN_CHIRPY_EVAL !== "1")(
  "composes framing keys with local speech anchors",
  async () => {
    for (const [content, anchor, phrase] of [
      [
        "Quickly zoom in and out of me as I enter my speech",
        "speechStart",
        undefined,
      ],
      [
        'Quickly zoom in and out of me as I say "here is the result"',
        "phrase",
        "here is the result",
      ],
    ] as const) {
      const request = input([{ role: "user", content }]);
      request.catalog = contract["x-actions"].filter(
        (action) => !("legacy" in action && action.legacy),
      );
      request.context = {
        ...context,
        speechAvailable: true,
        clips: [
          {
            id: "clip-speaker",
            mediaID: "media-speaker",
            sourceStart: 0,
            sourceEnd: 90,
          },
        ],
        media: [{ id: "media-speaker", name: "Speech.mp4", kind: "video" }],
      };
      const reply = await planChirpy(request);
      expect(reply.actions, reply.message).toHaveLength(1);
      expect(reply.actions[0].action).toBe("editor.video.animateFraming");
      const keys = reply.actions[0].arguments.keys as {
        at: { kind: string; phrase?: string; time?: number; offset?: number };
        scaleMultiplier: number;
        easing?: string;
      }[];
      expect(keys.length).toBeGreaterThanOrEqual(3);
      expect(keys[0].scaleMultiplier).toBe(1);
      expect(keys.at(-1)!.scaleMultiplier).toBe(1);
      expect(keys.some((key) => key.scaleMultiplier > 1)).toBe(true);
      for (const key of keys) {
        expect(key.at.kind, JSON.stringify(keys)).toBe(anchor);
        if (phrase) expect(key.at.phrase).toBe(phrase);
        expect(key.at.time).toBeUndefined();
      }
    }
  },
  100_000,
);

it.skipIf(process.env.RUN_CHIRPY_EVAL !== "1")(
  "masks a nonnumeric region and uses exact speech cues without redesigning it",
  async () => {
    const request = input([
      {
        role: "user",
        content:
          'Keep the Logo area covered in white, fade the cover away as I say "our new identity", then cover it again two seconds later. Leave all other areas unchanged.',
      },
    ]);
    request.catalog = contract["x-actions"].filter(
      (action) => !("legacy" in action && action.legacy),
    );
    request.context = {
      duration: 12,
      speechAvailable: true,
      selectedOverlayID: overlayID,
      overlays: [{ id: overlayID, timelineStart: 0, duration: 12 }],
      masks: [
        {
          overlayID,
          regions: [
            {
              id: "mask-logo",
              label: "Logo",
              rect: { x: 0.2, y: 0.3, width: 0.2, height: 0.2 },
              red: 1,
              green: 1,
              blue: 1,
            },
          ],
        },
      ],
    };
    const reply = await planChirpy(request);
    expect(reply.actions).toHaveLength(1);
    expect(reply.actions[0].action).toBe("editor.masks.setRegion");
    expect(reply.actions[0].arguments.regionID).toBe("mask-logo");
    const keys = reply.actions[0].arguments.opacityKeys as {
      at: { kind: string; phrase?: string; time?: number };
      opacity: number;
    }[];
    expect(keys[0].opacity).toBe(1);
    expect(keys.some((key) => key.opacity === 0)).toBe(true);
    expect(keys.at(-1)!.opacity).toBe(1);
    expect(
      keys.every(
        (key, index) =>
          (key.at.kind === "phrase" && key.at.phrase === "our new identity") ||
          (index === 0 &&
            key.at.kind === "time" &&
            key.at.time === 0 &&
            key.opacity === 1),
      ),
    ).toBe(true);
  },
  50000,
);

it.skipIf(process.env.RUN_CHIRPY_EVAL !== "1")(
  "declines unavailable tracked blur instead of applying a rectangular cover",
  async () => {
    const request = input([
      {
        role: "user",
        content:
          "Track the moving person throughout my footage and blur only their face. Do it now.",
      },
    ]);
    request.catalog = contract["x-actions"].filter(
      (action) => !("legacy" in action && action.legacy),
    );
    const reply = await planChirpy(request);
    expect(reply.actions).toEqual([]);
    expect(reply.message).toMatch(
      /unavailable|not (?:currently )?(?:available|supported)|can.t|cannot|doesn.t support|don.t (?:currently )?have/i,
    );
  },
  50000,
);

it.skipIf(process.env.RUN_CHIRPY_EVAL !== "1")(
  "places audio using general animation events and preserves visuals",
  async () => {
    const request = input([
      {
        role: "user",
        content: "Add click sounds when Clicks and Cost become visible.",
      },
    ]);
    request.catalog = contract["x-actions"].filter(
      (action) => !("legacy" in action && action.legacy),
    );
    request.context = {
      duration: 12,
      soundLibrary: context.soundLibrary,
      animationEvents: context.revealEvents.map((event) => ({
        ...event,
        id: event.id + "/opacity/1",
        property: "opacity",
        value: 0,
      })),
      sounds: [],
    };
    const reply = await planChirpy(request);
    expect(reply.actions).toHaveLength(1);
    expect(reply.actions[0].action).toBe("editor.audio.addAt");
    expect(reply.actions[0].arguments.effectID).toBe("mouse-click");
    const anchors = reply.actions[0].arguments.at as {
      kind: string;
      eventID: string;
    }[];
    expect(anchors.map((anchor) => anchor.eventID).sort()).toEqual(
      context.revealEvents.map((event) => event.id + "/opacity/1").sort(),
    );
    expect(anchors.every((anchor) => anchor.kind === "event")).toBe(true);
  },
  50000,
);

it.skipIf(!process.env.CHIRPY_MASK_VISION_IMAGE)(
  "locates a non-text area from source pixels without OCR regions",
  async () => {
    const { readFile } = await import("node:fs/promises");
    const request = input([
      {
        role: "user",
        content:
          "Put a black rectangular mask over the white block in this image. Keep it covered throughout.",
      },
    ]);
    request.catalog = contract["x-actions"].filter(
      (action) => !("legacy" in action && action.legacy),
    );
    request.context = {
      duration: 2,
      selectedOverlayID: overlayID,
      overlays: [
        {
          id: overlayID,
          mediaID: "source-image",
          timelineStart: 0,
          duration: 2,
        },
      ],
      media: [{ id: "source-image", kind: "image", name: "Shapes.jpg" }],
      selectedOverlayImage: {
        overlayID,
        width: 600,
        height: 400,
        detectedRegions: process.env.CHIRPY_MASK_VISION_REGIONS
          ? JSON.parse(
              await readFile(process.env.CHIRPY_MASK_VISION_REGIONS, "utf8"),
            )
          : undefined,
        jpeg: (await readFile(process.env.CHIRPY_MASK_VISION_IMAGE!)).toString(
          "base64",
        ),
      },
      masks: [],
    };
    const reply = await planChirpy(request);
    expect(reply.actions, reply.message).toHaveLength(1);
    expect(reply.actions[0].action).toBe("editor.masks.setRegion");
    const args = reply.actions[0].arguments;
    expect(args.regionID).toBeUndefined();
    expect(args.red).toBe(0);
    expect(args.green).toBe(0);
    expect(args.blue).toBe(0);
    const rect = args.rect as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    const overlapWidth = Math.max(
      0,
      Math.min(0.8, rect.x + rect.width) - Math.max(0.2, rect.x),
    );
    const overlapHeight = Math.max(
      0,
      Math.min(0.8, rect.y + rect.height) - Math.max(0.2, rect.y),
    );
    const intersection = overlapWidth * overlapHeight;
    expect(intersection / 0.36, JSON.stringify(rect)).toBeGreaterThan(0.9);
    expect(
      intersection / (0.36 + rect.width * rect.height - intersection),
    ).toBeGreaterThan(0.6);
  },
  50000,
);
