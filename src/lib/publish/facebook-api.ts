import { fetchBoundedJson } from "@/lib/http/outbound";

export const FACEBOOK_GRAPH = "https://graph.facebook.com/v26.0";
export class FacebookApiError extends Error {
  constructor(
    public readonly code: number,
    public readonly detail: string,
    public readonly uncertain = false,
  ) {
    super(`facebook_${code}: ${detail.slice(0, 300)}`);
  }
}
export async function facebookRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const { response, data } = await fetchBoundedJson<
    T & { error?: { code?: number; message?: string; is_transient?: boolean } }
  >(
    `${FACEBOOK_GRAPH}/${path}`,
    {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    },
    {
      timeoutMs: 20_000,
      maxBytes: 1024 * 1024,
      signal: init.signal ?? undefined,
    },
  );
  if (!response.ok || data.error)
    throw new FacebookApiError(
      data.error?.code ?? response.status,
      data.error?.message ?? "Facebook request failed",
      response.status >= 500 || data.error?.is_transient === true,
    );
  return data;
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  tasks?: string[];
}
/** Page tokens stay server-side. Ignore arbitrary pagination URLs from Graph. */
export async function listFacebookPages(
  token: string,
): Promise<FacebookPage[]> {
  const pages: FacebookPage[] = [];
  let after: string | undefined;
  for (let i = 0; i < 10; i++) {
    const query = new URLSearchParams({
      fields: "id,name,access_token,tasks",
      limit: "100",
    });
    if (after) query.set("after", after);
    const response = await facebookRequest<{
      data?: FacebookPage[];
      paging?: { next?: string; cursors?: { after?: string } };
    }>(`me/accounts?${query}`, token);
    pages.push(
      ...(response.data ?? []).filter(
        (p) =>
          /^\d+$/.test(p.id) &&
          p.access_token &&
          p.tasks?.some((t) => t === "CREATE_CONTENT" || t === "MANAGE"),
      ),
    );
    after = response.paging?.next ? response.paging.cursors?.after : undefined;
    if (!after) return pages;
  }
  throw new Error("facebook_too_many_pages");
}
