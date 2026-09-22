import {
  loadClientResource,
  STUDIO_RESOURCE_KEYS,
} from "@/lib/client-resource-cache";
import { listContent } from "@/lib/content/client";
import { listIdeas } from "@/lib/ideas/client";
import { getProject } from "@/lib/project/client";
import { fetchConnections } from "@/lib/publish/client";

/**
 * Fills the shared client cache with what the busiest Studio pages read
 * first, using the same keys and loaders as their hooks, so opening one of
 * those pages paints real rows instead of a skeleton. Failures are ignored:
 * the page's own hook reports them when it mounts.
 */
export function warmStudioData(): void {
  const warm = <T>(key: string, loader: () => Promise<T>) =>
    void loadClientResource(key, loader).catch(() => {});
  warm(STUDIO_RESOURCE_KEYS.project, getProject);
  warm(STUDIO_RESOURCE_KEYS.ideas, listIdeas);
  warm(STUDIO_RESOURCE_KEYS.content, () =>
    listContent({ includePosterUploads: false }),
  );
  warm(STUDIO_RESOURCE_KEYS.posterContent, () =>
    listContent({ includePosterUploads: true }),
  );
  warm(STUDIO_RESOURCE_KEYS.connections, fetchConnections);
}
