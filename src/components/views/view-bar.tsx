"use client";

import ViewSettings from "@/components/views/view-settings";
import ViewTabs from "@/components/views/view-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { useLibraryViews } from "@/hooks/use-library-views";

type LibraryViewsState = ReturnType<typeof useLibraryViews>;

/** Caution text on the shared yellow token, matching the chip tone mix so it
 * reads on both themes. */
const CAUTION_TEXT =
  "text-[color-mix(in_oklab,var(--sg-yellow-500)_48%,var(--sg-text))]";

/**
 * The view switcher above the library: saved-view tabs on the left, the
 * active view's settings on the right, on one hairline.
 *
 * Always rendered. The server seeds a default view on the first GET, so a
 * successful load never comes back empty; an empty list therefore means the
 * request is still in flight and gets skeleton tabs instead of a blank strip.
 * A failed load says so and leaves the default table usable.
 */
export default function ViewBar({ views }: { views: LibraryViewsState }) {
  const loading = views.views.length === 0 && !views.failed;

  return (
    <div className="mb-4">
      <div className="border-border flex flex-wrap items-center gap-1 border-b pb-px">
        {loading ? (
          <div className="flex items-center gap-2 px-1 pb-2" aria-hidden>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ) : views.failed ? (
          <p
            className={`px-1 pb-2 text-xs font-semibold ${CAUTION_TEXT}`}
            role="alert"
          >
            Couldn&apos;t load your saved views. Showing the default table.
          </p>
        ) : (
          <ViewTabs
            views={views.views}
            activeId={views.active?.id ?? null}
            onSelect={views.setActiveId}
            onAdd={() =>
              void views.create({
                name: "New view",
                kind: "table",
                groupBy: null,
                filters: {},
                columns: [],
              })
            }
          />
        )}

        {views.active && (
          <div className="ml-auto">
            <ViewSettings
              view={views.active}
              onSave={(draft) => void views.save(views.active!.id, draft)}
              onDelete={() => void views.remove(views.active!.id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
