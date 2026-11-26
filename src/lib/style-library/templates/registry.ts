import { SAMPLE_CLIP } from "../samples/sample-take";
import type { Template, TemplateLayer } from "./template";

const layout = (block: TemplateLayer["block"]): TemplateLayer => ({
  id: "layout",
  label: "Layout",
  accepts: ["layouts", "splits"],
  block,
});

const overlay = (block: TemplateLayer["block"] = null): TemplateLayer => ({
  id: "overlay",
  label: "Over the speaker",
  accepts: ["cards", "overlays", "hooks"],
  block,
});

const captions: TemplateLayer = {
  id: "captions",
  label: "Captions",
  accepts: ["captions"],
  block: { styleId: "captions.plain-white" },
};

/** First-party templates. Each is only a starting arrangement: every place in it can be edited or swapped. */
export const TEMPLATES: readonly Template[] = [
  {
    id: "talking-head",
    name: "Talking head",
    summary:
      "The take on the whole frame with captions under the chin. Room for one card above the speaker.",
    layers: [layout({ styleId: "layouts.full-frame" }), overlay(), captions],
  },
  {
    id: "half-and-half",
    name: "Half and half",
    summary:
      "Camera in the bottom half, a clip or screenshot in the top half, captions just under the seam.",
    layers: [
      layout({
        styleId: "splits.half-and-half",
        slots: {
          top: { styleId: "overlays.media", content: { src: SAMPLE_CLIP } },
        },
      }),
      overlay(),
      captions,
    ],
  },
  {
    id: "speaker-card",
    name: "Speaker card",
    summary:
      "The speaker in a rounded card at the bottom, breaking out past its edge, a picture or clip above on the dotted grid.",
    layers: [
      layout({
        styleId: "splits.speaker-below",
        options: { backdrop: "dots", popOut: true },
        slots: {
          visual: { styleId: "overlays.media", content: { src: SAMPLE_CLIP } },
        },
      }),
      overlay(),
      captions,
    ],
  },
  {
    id: "speaker-below",
    name: "Speaker below",
    summary:
      "The speaker as a card at the bottom, a glass card on the blurred take above.",
    layers: [
      layout({
        styleId: "splits.speaker-below",
        slots: {
          visual: {
            styleId: "cards.smoked-glass",
            options: { scale: 1.5 },
            content: {
              label: "Signups this week",
              value: "1,284",
              detail: "Up from 960 last week",
            },
          },
        },
      }),
      overlay(),
      captions,
    ],
  },
];

export const getTemplate = (id: string): Template | undefined =>
  TEMPLATES.find((template) => template.id === id);
