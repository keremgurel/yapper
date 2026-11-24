import { actionTools, callActionTool } from "./action-tools";
import { callContextTool, CONTEXT_TOOLS } from "./context-tools";
import type { McpCaller } from "./tool-types";

/** The MCP revisions this server answers in. The newest is offered when a client asks for another. */
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS =
  "Yapper is a studio for people who make talking-head videos. These tools read and change the creator's saved looks: arrangements of blocks (a layout, what sits in it, the captions over it). Call studio_styles_context first. It lists the templates a look can start from, each block's option keys and allowed values, and the creator's looks. Then save a look from a template and edit it by place, for example at 'layout' to change a split's backdrop, at 'layout.top' to change what the top half shows, at 'captions' to restyle the captions. A refused edit says what would have worked.";

interface RpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

type RpcReply =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | {
      jsonrpc: "2.0";
      id: string | number | null;
      error: { code: number; message: string };
    };

const isRequest = (value: unknown): value is RpcRequest =>
  !!value &&
  typeof value === "object" &&
  (value as RpcRequest).jsonrpc === "2.0" &&
  typeof (value as RpcRequest).method === "string";

async function result(
  caller: McpCaller,
  { method, params = {} }: RpcRequest,
): Promise<unknown> {
  switch (method) {
    case "initialize": {
      const asked =
        typeof params.protocolVersion === "string"
          ? params.protocolVersion
          : "";
      return {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked)
          ? asked
          : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: {
          name: "yapper",
          title: "Yapper Studio",
          version: "0.1.0",
        },
        instructions: INSTRUCTIONS,
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return { tools: [...CONTEXT_TOOLS, ...actionTools()] };
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      const args =
        params.arguments &&
        typeof params.arguments === "object" &&
        !Array.isArray(params.arguments)
          ? (params.arguments as Record<string, unknown>)
          : {};
      const called =
        (await callContextTool(caller, name, args)) ??
        (await callActionTool(caller, name, args));
      if (!called) throw new RpcError(-32602, `Unknown tool: ${name}`);
      return called;
    }
    default:
      throw new RpcError(-32601, `Method not found: ${method}`);
  }
}

class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Answers one JSON-RPC message from a connector. `null` for a notification,
 * which gets no reply.
 */
export async function handleMcpMessage(
  caller: McpCaller,
  message: unknown,
): Promise<RpcReply | null> {
  if (!isRequest(message)) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid request" },
    };
  }
  if (message.id === undefined) return null;
  try {
    return {
      jsonrpc: "2.0",
      id: message.id,
      result: await result(caller, message),
    };
  } catch (error) {
    if (!(error instanceof RpcError)) {
      console.error(
        "[mcp] request failed",
        message.method,
        error instanceof Error ? error.message : "unknown",
      );
    }
    return {
      jsonrpc: "2.0",
      id: message.id,
      error:
        error instanceof RpcError
          ? { code: error.code, message: error.message }
          : { code: -32603, message: "Internal error" },
    };
  }
}
