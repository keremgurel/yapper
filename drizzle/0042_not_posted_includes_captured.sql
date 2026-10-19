-- 0023 rewrote the old "Not posted" default (drafted, planned, scheduled) to
-- drafting, ready, ready, so every workspace seeded before it hides Captured
-- ideas from that view. New workspaces are seeded with captured, drafting and
-- ready. Bring the old ones in line. A view the creator renamed still carries
-- the duplicated "ready" the rewrite left behind, so match on that too, and
-- leave alone any filter that already names captured or posted.
UPDATE "library_views"
SET "filters" = jsonb_set("filters", '{status}', '["captured","drafting","ready"]'::jsonb)
WHERE "stage" = 'library'
  AND jsonb_typeof("filters"->'status') = 'array'
  AND NOT ("filters"->'status' @> '["captured"]'::jsonb)
  AND NOT ("filters"->'status' @> '["posted"]'::jsonb)
  AND ("name" = 'Not posted' OR "filters"->'status' = '["drafting","ready","ready"]'::jsonb);
