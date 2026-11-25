import { styleCatalog } from "../catalog";
import { describeTemplate } from "./describe-template";
import { editTemplate, type TemplateEdit } from "./edit-template";
import { TEMPLATES } from "./registry";
import type { Template } from "./template";

/**
 * The tool surface for a model editing a template: Chirpy's planner today, a
 * Claude or ChatGPT connector later. Names, descriptions and JSON Schema only.
 * Transport, sign-in and where the template is stored belong to the route
 * that exposes these.
 */
export interface TemplateTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const place = {
  type: "string",
  description:
    "A place in the template, from describe_template, for example 'layout.top' or 'captions'.",
};
const values = { type: "object", additionalProperties: true };

export const TEMPLATE_TOOLS: readonly TemplateTool[] = [
  {
    name: "list_styles",
    description:
      "Every building block in the library by shelf, with its options, limits and the rules behind its defaults.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_templates",
    description:
      "The ready-made arrangements of blocks a video can start from.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "describe_template",
    description:
      "The current template: each place, the block in it, what else could go there, and every setting with its value and limits. Call this before editing.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "edit_template",
    description:
      "Change one place. setOptions changes the look (for example the backdrop of a split). setContent changes what it shows (a picture, a title). setBlock swaps the block for another style (for example a different caption style). clear empties the place.",
    inputSchema: {
      type: "object",
      required: ["op", "at"],
      additionalProperties: false,
      properties: {
        op: { enum: ["setOptions", "setContent", "setBlock", "clear"] },
        at: place,
        styleId: {
          type: "string",
          description: "For setBlock: the style to put there.",
        },
        options: values,
        content: values,
      },
    },
  },
];

export type ToolReply = { template: Template; result: unknown };

/** Runs one tool call against a template. Edits return the new template; everything else leaves it as it was. */
export function callTemplateTool(
  template: Template,
  name: string,
  input: Record<string, unknown> = {},
): ToolReply {
  switch (name) {
    case "list_styles":
      return { template, result: styleCatalog() };
    case "list_templates":
      return {
        template,
        result: TEMPLATES.map(({ id, name: title, summary }) => ({
          id,
          name: title,
          summary,
        })),
      };
    case "describe_template":
      return { template, result: describeTemplate(template) };
    case "edit_template": {
      const outcome = editTemplate(template, input as TemplateEdit);
      return outcome.ok
        ? {
            template: outcome.template,
            result: {
              ok: true,
              notes: outcome.notes,
              now: describeTemplate(outcome.template),
            },
          }
        : { template, result: outcome };
    }
    default:
      return {
        template,
        result: {
          ok: false,
          message: `No tool called '${name}'.`,
          valid: TEMPLATE_TOOLS.map((tool) => tool.name),
        },
      };
  }
}
