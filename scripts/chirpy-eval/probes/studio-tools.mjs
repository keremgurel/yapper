/**
 * Stand-in Studio tools so the caching probe carries about 100 strict tools,
 * the size the v2 catalog is expected to reach once every surface has
 * actions. The schemas are plausible in size and shape, not the real ones.
 */
const SURFACES = {
  ideas: "a content idea (title, notes, pillar, versions)",
  calendar: "a calendar slot for a planned post",
  brain: "a Brain knowledge entry the assistant writes from",
  brand: "the creator's brand colours, fonts and voice",
  poster: "a prepared social post (caption, thumbnail, platforms)",
  automations: "an automation rule that runs on a trigger",
  dictionary: "a custom spelling for transcripts and captions",
  storage: "a stored project or media file",
};

const VERBS = {
  create: "Create",
  update: "Change fields of",
  delete: "Delete",
  list: "List",
  get: "Read one",
  duplicate: "Duplicate",
};

function schemaFor(verb) {
  const id = {
    type: "string",
    format: "uuid",
    description: "Existing item ID from a read result.",
  };
  const fields = {
    title: {
      type: "string",
      maxLength: 200,
      description: "Short human readable name.",
    },
    notes: {
      type: ["string", "null"],
      maxLength: 4000,
      description: "Free text body; null leaves it unchanged.",
    },
    tags: {
      type: ["array", "null"],
      maxItems: 20,
      items: { type: "string", maxLength: 40 },
      description: "Labels used for filtering; null leaves them unchanged.",
    },
    date: {
      type: ["string", "null"],
      description: "ISO 8601 date, or null for none.",
    },
  };
  const properties =
    verb === "create"
      ? fields
      : verb === "update"
        ? { id, ...fields }
        : verb === "list"
          ? {
              query: {
                type: ["string", "null"],
                maxLength: 200,
                description: "Optional text filter.",
              },
              limit: {
                type: "integer",
                minimum: 1,
                maximum: 50,
                description: "Page size.",
              },
            }
          : { id };
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

export function studioTools() {
  return Object.entries(SURFACES).flatMap(([surface, noun]) =>
    Object.entries(VERBS).map(([verb, label]) => ({
      type: "function",
      function: {
        name: `studio_${surface}_${verb}`,
        description: `${label} ${noun}.`,
        parameters: schemaFor(verb),
        strict: true,
      },
    })),
  );
}
