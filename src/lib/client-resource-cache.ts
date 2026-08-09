type Listener = () => void;

type ResourceEntry = {
  data?: unknown;
  generation: number;
  updatedAt: number;
  promise?: Promise<unknown>;
  listeners: Set<Listener>;
};

const resources = new Map<string, ResourceEntry>();

function entry(key: string): ResourceEntry {
  let current = resources.get(key);
  if (!current) {
    current = { generation: 0, updatedAt: 0, listeners: new Set() };
    resources.set(key, current);
  }
  return current;
}

function publish(current: ResourceEntry): void {
  for (const listener of current.listeners) listener();
}

/** Shared, session-scoped cache for the desktop/web Studio's client reads. */
export function readClientResource<T>(key: string): T | null {
  return (resources.get(key)?.data as T | undefined) ?? null;
}

export function subscribeClientResource(
  key: string,
  listener: Listener,
): () => void {
  const current = entry(key);
  current.listeners.add(listener);
  return () => current.listeners.delete(listener);
}

export async function loadClientResource<T>(
  key: string,
  loader: () => Promise<T>,
  options: { force?: boolean; staleAfter?: number } = {},
): Promise<T> {
  const current = entry(key);
  const staleAfter = options.staleAfter ?? 30_000;
  if (
    !options.force &&
    current.data !== undefined &&
    Date.now() - current.updatedAt < staleAfter
  ) {
    return current.data as T;
  }
  if (current.promise) return current.promise as Promise<T>;

  const generation = current.generation;
  const request = loader().then(
    (data) => {
      if (current.generation !== generation) return data;
      current.data = data;
      current.updatedAt = Date.now();
      current.promise = undefined;
      publish(current);
      return data;
    },
    (error: unknown) => {
      if (current.generation === generation) current.promise = undefined;
      throw error;
    },
  );
  current.promise = request;
  return request;
}

export function mutateClientResource<T>(
  key: string,
  update: T | ((current: T | null) => T),
): T {
  const current = entry(key);
  const previous = (current.data as T | undefined) ?? null;
  const next =
    typeof update === "function"
      ? (update as (value: T | null) => T)(previous)
      : update;
  current.data = next;
  current.updatedAt = Date.now();
  publish(current);
  return next;
}

export function invalidateClientResource(key: string): void {
  const current = resources.get(key);
  if (current) current.updatedAt = 0;
}

/** Drop user-scoped values while retaining active subscriptions. */
export function clearClientResources(): void {
  for (const current of resources.values()) {
    current.generation += 1;
    current.data = undefined;
    current.updatedAt = 0;
    current.promise = undefined;
    publish(current);
  }
}

export const STUDIO_RESOURCE_KEYS = {
  ideas: "studio:ideas",
  content: "studio:content",
  posterContent: "studio:content:poster",
  connections: "studio:connections",
  views: (stage: string) => `studio:views:${stage}`,
  channel: (platform: string) => `studio:channel:${platform}`,
} as const;
