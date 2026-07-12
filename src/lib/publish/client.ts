import type { PublishPlatform } from "@/lib/db/schema";

/** A platform connection as the UI sees it (never any token). */
export interface ConnectionSummary {
  platform: PublishPlatform;
  handle: string | null;
  externalAccountId: string | null;
  status: string;
  updatedAt: string;
}

export interface ConnectionsResponse {
  connections: ConnectionSummary[];
  /** Platforms that are actually connectable (OAuth app + token key set). */
  available: PublishPlatform[];
}

export async function fetchConnections(): Promise<ConnectionsResponse> {
  const res = await fetch("/api/publish/connections");
  if (!res.ok) throw new Error(`connections_${res.status}`);
  return (await res.json()) as ConnectionsResponse;
}

export async function disconnectPlatform(
  platform: PublishPlatform,
): Promise<void> {
  const res = await fetch(`/api/publish/connections/${platform}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`disconnect_${res.status}`);
}

/** The connect flow is a full-page redirect to the provider's consent screen. */
export function connectUrl(platform: PublishPlatform): string {
  return `/api/publish/connect/${platform}`;
}
