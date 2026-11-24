"use client";

import { useCallback } from "react";
import { useClientResource } from "@/hooks/use-client-resource";
import { STUDIO_RESOURCE_KEYS } from "@/lib/client-resource-cache";
import type { TemplateEdit } from "@/lib/style-library/templates/edit-template";
import type { TemplateDescription } from "@/lib/style-library/templates/describe-template";
import type { Template } from "@/lib/style-library/templates/template";

export interface SavedLook {
  id: string;
  name: string;
  layers: Template["layers"];
}

/** The server sends a look described for reading; the gallery needs its layers back. */
interface LooksReply {
  looks: (TemplateDescription & { layers?: Template["layers"] })[];
}

const EDITS_PER_CALL = 8;

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const reply = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) {
    throw new Error(
      typeof reply.detail === "string"
        ? reply.detail
        : String(reply.error ?? "failed"),
    );
  }
  return reply;
}

/** Sends edits in the batches the contract allows. Each batch is all or nothing. */
async function patchEdits(
  id: string,
  edits: readonly TemplateEdit[],
  name?: string,
) {
  let last: Record<string, unknown> = {};
  for (
    let start = 0;
    start < Math.max(edits.length, 1);
    start += EDITS_PER_CALL
  ) {
    last = await send(`/api/styles/looks/${id}`, "PATCH", {
      ...(name && start === 0 ? { name } : {}),
      edits: edits.slice(start, start + EDITS_PER_CALL),
    });
  }
  return last.look as SavedLook;
}

/** The creator's saved looks, and the two ways to write one. */
export function useLooks() {
  const { data, error, refresh } = useClientResource(
    STUDIO_RESOURCE_KEYS.styles,
    true,
    async () => {
      const reply = (await send("/api/styles", "GET")) as unknown as LooksReply;
      return reply.looks.map(
        (look): SavedLook => ({
          id: look.id,
          name: look.name,
          layers: look.layers ?? [],
        }),
      );
    },
  );

  /** Start a look from a template or another look, then apply the edits made in the gallery. */
  const saveNew = useCallback(
    async (from: string, name: string, edits: readonly TemplateEdit[]) => {
      const created = (await send("/api/styles/looks", "POST", { from, name }))
        .look as SavedLook;
      const saved = edits.length
        ? await patchEdits(created.id, edits)
        : created;
      await refresh();
      return saved;
    },
    [refresh],
  );

  const saveChanges = useCallback(
    async (id: string, edits: readonly TemplateEdit[]) => {
      const saved = await patchEdits(id, edits);
      await refresh();
      return saved;
    },
    [refresh],
  );

  const state = data ? "ready" : error ? "unavailable" : "loading";
  return { looks: data ?? [], state, saveNew, saveChanges } as const;
}
