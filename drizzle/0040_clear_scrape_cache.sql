-- The first scrape_cache keys (0039) were loose URL forms, and YouTube creator
-- feeds read with a user's own token were stored under them. Keys are now
-- strict ids and YouTube is never cached, so every existing row is unreachable
-- and some may hold private uploads. The cache was live for hours; clear it.
DELETE FROM "scrape_cache";
