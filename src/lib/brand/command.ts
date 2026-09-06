import {
  MAX_BRAND_COLORS,
  normalizeBrandColor,
  parseBrandColors,
} from "./colors";

export type BrandCommand =
  | { kind: "show" }
  | { kind: "clarify"; message: string }
  | {
      kind: "update";
      operation: "set" | "add" | "remove" | "primary";
      colors: string[];
    };

const SUBJECT =
  "(?:(?:my|our|the)\\s+)?(?:(?:brand(?:\\s+kit)?\\s+)?colou?rs?|(?:brand\\s+)?palette|brand\\s+kit)";
const PREFIX =
  /^(?:(?:hey\s+)?chirpy[,!:]?\s+)?(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?/i;
const COLOR_HELP =
  "Tell me the exact colors, for example ‘My brand colors are #FF7A21, black, and white’. I can also add or remove a color, or make one primary. For custom shades, use a hex code.";

function colorList(text: string): string[] | null {
  const parts = text
    .replace(/(#[\da-z]+)\s+(?=#)/gi, "$1, ")
    .split(/\s*(?:[,;\n]|\band\b|&)\s*/i)
    .filter(Boolean);
  const colors = parts.map((part) => {
    // Accept labels such as “primary: #FF7A21” and “orange (#FF7A21)”.
    const hex = part.match(/#[\da-z]+/gi);
    if (hex?.length === 1 && /^[\w\s:()#-]+$/.test(part))
      return normalizeBrandColor(hex[0]);
    return normalizeBrandColor(
      part.replace(
        /^(?:primary|secondary|accent|background|text)(?:\s+colou?r)?\s*:\s*/i,
        "",
      ),
    );
  });
  return colors.length && colors.every((color) => color !== null)
    ? parseBrandColors(colors)
    : null;
}

/** Handle explicit kit commands locally. Advice/questions do not write data. */
export function parseBrandCommand(
  raw: string,
  inBrandConversation = false,
): BrandCommand | null {
  const text = raw
    .trim()
    .replace(PREFIX, "")
    .replace(/[.!?]+$/, "")
    .trim();
  if (
    /\b(?:don['’]?t|not|never|instead of|without|if|maybe|should|recommend|suggest)\b/i.test(
      text,
    )
  )
    return null;
  if (
    new RegExp(
      `^(?:(?:show|open|bring up|pull up|put up|view)(?:\\s+me)?\\s+${SUBJECT}|what(?:'s| is| are)\\s+${SUBJECT}|${SUBJECT})$`,
      "i",
    ).test(text)
  )
    return { kind: "show" };

  let operation: "set" | "add" | "remove" | "primary" = "set";
  let payload: string | undefined;
  const primary = text.match(
    new RegExp(
      `^(?:make|set)\\s+(.+?)\\s+(?:(?:as|to)\\s+)?(?:(?:my|our|the)\\s+)?primary(?:\\s+(?:brand\\s+)?colou?r)?$`,
      "i",
    ),
  );
  const primaryStatement = text.match(
    /^(?:(?:my|our|the)\s+)?primary(?:\s+brand)?\s+colou?r\s*(?:is|:|=)\s*(.+)$/i,
  );
  const edit = text.match(
    new RegExp(
      `^(add|remove|delete)\\s+(.+?)\\s+(?:to|from)\\s+${SUBJECT}$`,
      "i",
    ),
  );
  const statement = text.match(
    new RegExp(`^${SUBJECT}\\s*(?:are|is|:|=)\\s*(.+)$`, "i"),
  );
  const set = text.match(
    new RegExp(
      `^(?:set|update|change|save|remember|replace|build|create|make|set up)\\s+${SUBJECT}\\s*(?:(?:to|as|with|using|are|is)\\s+|:\\s*)(.+)$`,
      "i",
    ),
  );
  const use = text.match(
    new RegExp(`^use\\s+(.+?)\\s+(?:for|as|in)\\s+${SUBJECT}$`, "i"),
  );
  const conversational = text.match(
    new RegExp(
      `^(?:I (?:want|would like) to |let['’]s )?use\\s+(.+?)\\s+(?:for|in)\\s+(?:my|our|the)\\s+brand(?:\\s+kit)?$`,
      "i",
    ),
  );
  const brandUses = text.match(/^(?:my|our|the)\s+brand\s+uses\s+(.+)$/i);
  if (primary || primaryStatement) {
    operation = "primary";
    payload = primary?.[1] ?? primaryStatement?.[1];
  } else if (edit) {
    operation = edit[1].toLowerCase() === "add" ? "add" : "remove";
    payload = edit[2];
  } else
    payload =
      statement?.[1] ??
      set?.[1] ??
      use?.[1] ??
      conversational?.[1] ??
      brandUses?.[1];

  if (!payload && inBrandConversation && colorList(text)) payload = text;
  if (!payload) {
    // An explicit request to build a kit without usable colors needs input,
    // rather than falling into generic Knowledge capture or invented success.
    return new RegExp(
      `^(?:set|save|remember|update|change|build|create|make|set up)\\s+${SUBJECT}(?:\\s|$)`,
      "i",
    ).test(text)
      ? { kind: "clarify", message: COLOR_HELP }
      : null;
  }
  const colors = colorList(payload);
  if (!colors || (operation === "primary" && colors.length !== 1))
    return {
      kind: "clarify",
      message: `${COLOR_HELP} A kit holds up to ${MAX_BRAND_COLORS} colors.`,
    };
  return { kind: "update", operation, colors };
}

export function applyBrandCommand(
  command: Extract<BrandCommand, { kind: "update" }>,
  current: readonly string[],
): string[] {
  const colors =
    command.operation === "set"
      ? command.colors
      : command.operation === "add"
        ? [...new Set([...current, ...command.colors])]
        : command.operation === "remove"
          ? current.filter((color) => !command.colors.includes(color))
          : [
              command.colors[0],
              ...current.filter((color) => color !== command.colors[0]),
            ];
  if (colors.length > MAX_BRAND_COLORS) throw new Error("brand_color_limit");
  return colors;
}
