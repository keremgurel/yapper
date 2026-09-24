-- One always-on starter: how every piece of writing should sound. It merges
-- the no-ai-slop editing rules with the creator's list of AI giveaways, cut
-- down to what changes a spoken script, a hook or a caption. The compiler
-- reads it on every writing call instead of routing it (always-on.ts).
-- ON CONFLICT DO NOTHING so an edit made in production survives a redeploy.
INSERT INTO "skill_catalog" ("slug","version","kind","name","tagline","when_to_use","instructions","surfaces","formats","category","published","sort_order") VALUES
('write-like-a-person',1,'skill','Write like a person',
 $q$Keeps every script, hook and caption free of the lines that give AI writing away.$q$,
 $q$Always on. Read before anything is written.$q$,
 $q$Write the way this creator talks. Before you return anything, reread it and rewrite every line that does one of these.

Never use em dashes or en dashes. Use a period, a comma or a colon.

Never frame a point as a contrast with something nobody said: "not X, but Y", "it's not about X, it's about Y", "not because X, but because Y", "this isn't X. It's Y." Say Y.

Don't stack abstract nouns or adjectives in threes, or fives: "clear, concise and compelling", "status, friction, timing and trust". Keep the one that matters and show it with an example.

Cut setups that pose as insight: "here's what nobody tells you", "the part most people miss", "that is exactly why", "this is for you if", "what if I told you", a question you answer yourself, "the answer lies in".

Cut filler and hype: in today's world, the landscape of, tapestry, game changer, unlock, supercharge, leverage, elevate, seamless, robust, exciting, powerful, revolutionary, groundbreaking, incredible.

No colon reveals ("The best part: it learns"), no strings of punchy fragments, no recap at the end, and no closing line that sounds deep but says nothing. End on the last concrete point or the next step.

Don't cover every angle evenly. Take a side and say why.

Be specific. A name, a number, what happened, what it looked like. If a line could be said by any creator in the niche, it isn't finished.

Use plain verbs. "Is" and "has" are fine. Mix short sentences with longer ones the way people talk.

The creator's own voice wins. If their Essentials or their videos use a phrase these rules would normally cut, keep it.$q$,
 '[]'::jsonb,'[]'::jsonb,'Writing',true,5)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
-- Existing projects get their own copy at the top of their list. A project
-- with no skills yet receives it with the other starters on first read.
INSERT INTO "project_skills" ("project_id","catalog_slug","catalog_version","name","when_to_use","instructions","surfaces","formats","enabled","customized","sort_order")
SELECT p."id", c."slug", c."version", c."name", c."when_to_use", c."instructions", c."surfaces", c."formats", true, false,
  coalesce((SELECT min(s."sort_order") - 1 FROM "project_skills" s WHERE s."project_id" = p."id"), 0)
FROM "projects" p
CROSS JOIN "skill_catalog" c
WHERE c."slug" = 'write-like-a-person'
  AND EXISTS (SELECT 1 FROM "project_skills" s WHERE s."project_id" = p."id")
ON CONFLICT ("project_id","catalog_slug") DO NOTHING;
