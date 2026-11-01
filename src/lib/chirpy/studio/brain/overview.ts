import { describeBlock, excerptBlock } from "@/lib/brain/context/excerpt";
import { clamp, overlapScore, tokenize } from "@/lib/brain/context/text";
import type { BrainSnapshot } from "@/lib/brain/context/types";

/**
 * What the Studio planner sees of the creator's Brain on a turn that needs it,
 * built to stay near 1.5k tokens however much the Brain holds: Essentials cut
 * to a card, Knowledge as one line per section in the creator's order, and
 * the sections that match the request quoted by relevance, never whole.
 * Pure, so the budget can be tested without a database.
 */
export interface BrainOverview {
  essentials: Record<string, string>;
  /** Pillar descriptions by name; the ids are in the overview's pillars. */
  pillarNotes?: Record<string, string>;
  knowledge: BrainKnowledgeLine[];
  /** Sections not listed because the Brain holds more than the cap. */
  moreKnowledge?: number;
  /** Excerpts of the sections whose words match the request. */
  read?: { id: string; text: string }[];
  skills: { id: string; name: string; off?: true }[];
  catalog?: { slug: string; name: string; kind: string; installed?: true }[];
  voice: {
    samples: BrainSampleLine[];
    moreSamples?: number;
    connected: string[];
  };
}

export interface BrainKnowledgeLine {
  id: string;
  title: string;
  /** What it is, when the creator wrote no digest: "table, 120 rows". */
  digest: string;
  /** Omitted for an ordinary note. */
  kind?: string;
  /** Omitted for "auto", the default. */
  usage?: string;
  /** 1-based, only when the list is cut. */
  position?: number;
}

export interface BrainSampleLine {
  id: string;
  title: string;
  platform: string;
}

export interface BrainOverviewSource {
  project: Record<string, unknown>;
  snapshot: BrainSnapshot;
  samples: BrainSampleLine[];
  sampleCount: number;
  connected: string[];
  catalog?: { slug: string; name: string; kind: string }[];
}

/** Each Essentials field with the words a request about it would use. A
 * field the request is about is shown at nearly what prompts read of it; the
 * others are cut short, so a question gets its answer whole without every
 * turn paying for the whole card. The words are matched after `tokenize`,
 * which drops "who", "make", "about", "content" and "video". */
const ESSENTIALS = {
  name: ["name", "channel", "brand", "called"],
  whatIMake: ["niche", "topic", "subject", "videos"],
  audience: ["audience", "viewer", "follower", "people", "target"],
  voice: ["voice", "sound", "tone", "style", "talk"],
  scriptingPatterns: ["script", "scripting", "structure", "hook", "intro"],
  offers: ["offer", "promote", "promoting", "sell", "product", "plug"],
  doNots: ["never", "avoid", "don't", "rule", "say"],
  defaultFormat: ["format", "default"],
} as const;
const ESSENTIAL_CHARS = 100;
const ESSENTIAL_ASKED_CHARS = 400;
const PILLAR_NOTE_CHARS = 120;
const KNOWLEDGE_LINES = 10;
const RELEVANT_LINES = 4;
const DIGEST_CHARS = 50;
const READ_CHARS = 700;
const READ_EACH = 400;
const READ_BLOCKS = 3;
const SKILL_LINES = 20;
const SAMPLE_TITLE_CHARS = 48;
const CATALOG_LINES = 24;

export function buildBrainOverview(
  source: BrainOverviewSource,
  request: string,
): BrainOverview {
  const tokens = tokenize(request);
  const { snapshot } = source;

  const essentials: Record<string, string> = {};
  for (const [key, words] of Object.entries(ESSENTIALS)) {
    const value = String(source.project[key] ?? "").trim();
    const asked = words.some((word) => tokens.has(word));
    if (value)
      essentials[key] = clamp(
        value,
        asked ? ESSENTIAL_ASKED_CHARS : ESSENTIAL_CHARS,
      );
  }

  const pillarNotes = Object.fromEntries(
    snapshot.pillars
      .filter((pillar) => pillar.description.trim())
      .map((pillar) => [
        pillar.name,
        clamp(pillar.description.trim(), PILLAR_NOTE_CHARS),
      ]),
  );

  const scored = snapshot.blocks.map((block, index) => ({
    block,
    index,
    score: overlapScore(
      tokens,
      `${block.title} ${block.digest} ${block.tags.join(" ")}`,
    ),
  }));
  const relevant = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const cut = scored.length > KNOWLEDGE_LINES;
  const listed = cut
    ? [
        ...new Set([
          ...relevant.slice(0, RELEVANT_LINES),
          ...scored.slice(0, KNOWLEDGE_LINES),
        ]),
      ]
        .slice(0, KNOWLEDGE_LINES)
        .sort((a, b) => a.index - b.index)
    : scored;
  const knowledge = listed.map(
    ({ block, index }): BrainKnowledgeLine => ({
      id: block.id,
      title: block.title,
      digest: clamp(block.digest.trim() || describeBlock(block), DIGEST_CHARS),
      ...(block.kind === "note" ? {} : { kind: block.kind }),
      ...(block.usage === "auto" ? {} : { usage: block.usage }),
      ...(cut ? { position: index + 1 } : {}),
    }),
  );

  let room = READ_CHARS;
  const read: { id: string; text: string }[] = [];
  for (const { block } of relevant.slice(0, READ_BLOCKS)) {
    if (room < 120) break;
    const text = excerptBlock(block, tokens, Math.min(READ_EACH, room));
    if (!text.trim()) continue;
    read.push({ id: block.id, text });
    room -= text.length;
  }

  const installed = new Set(
    snapshot.skills.map((skill) => skill.slug).filter(Boolean),
  );
  return {
    essentials,
    ...(Object.keys(pillarNotes).length ? { pillarNotes } : {}),
    knowledge,
    ...(cut ? { moreKnowledge: scored.length - knowledge.length } : {}),
    ...(read.length ? { read } : {}),
    skills: snapshot.skills.slice(0, SKILL_LINES).map((skill) => ({
      id: skill.id,
      name: skill.name,
      ...(skill.enabled ? {} : { off: true as const }),
    })),
    ...(source.catalog
      ? {
          catalog: source.catalog.slice(0, CATALOG_LINES).map((entry) => ({
            ...entry,
            ...(installed.has(entry.slug) ? { installed: true as const } : {}),
          })),
        }
      : {}),
    voice: {
      samples: source.samples.map((sample) => ({
        ...sample,
        title: clamp(sample.title, SAMPLE_TITLE_CHARS),
      })),
      ...(source.sampleCount > source.samples.length
        ? { moreSamples: source.sampleCount - source.samples.length }
        : {}),
      connected: source.connected,
    },
  };
}
