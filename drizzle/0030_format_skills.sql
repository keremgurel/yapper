ALTER TABLE "skill_catalog" ADD COLUMN "formats" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Two starter methods for the long-form and article versions of an idea,
-- written from docs/video-scripting-research.md. ON CONFLICT DO NOTHING so an
-- edit made to these rows in production is never overwritten by a redeploy.
INSERT INTO "skill_catalog" ("slug","version","kind","name","tagline","when_to_use","instructions","surfaces","formats","category","published","sort_order") VALUES
('chapters-that-hold',1,'skill','Chapters that hold',
 $q$A long-form script where every chapter earns the next one.$q$,
 $q$Writing or editing a long-form video script.$q$,
 $q$Write the long-form as chapters that each earn the next one.

Open chapter one on the payoff the title promised, or the clearest promise of it, in the first line. No greeting, no channel name, no "in this video". State the stakes in one sentence and tease the best moment.

Every chapter starts with a question or a claim the viewer wants settled, and ends on a "but" or "therefore" line that opens the next chapter. If two chapters connect with "and then", merge them or cut one.

Put the second strongest point in the first body chapter, and order the rest so the stakes rise. Give every point a concrete example or a short story; an assertion on its own is where people click away.

Where the idea fits it, name the belief the audience holds and overturn it early: most people think this, here is why that is wrong.

The last chapter pays off what the first one opened and calls back to its opening line. Then one line pointing to a next video, and stop. No summary.$q$,
 '["script","expand"]'::jsonb,'["long"]'::jsonb,'Long-form',true,35),

('skimmable-sections',1,'skill','Skimmable sections',
 $q$An article that gives its answer to someone who only skims.$q$,
 $q$Writing or editing an article or newsletter version of an idea.$q$,
 $q$Write for someone who scans before they read.

Give the answer in the opening paragraphs, so a reader who stops there still has it.

Each section heading is a claim, not a label: "Early marketing fails because it is accurate but lifeless", not "The problem". The first sentence under each heading carries that section's point; the rest supports it. One idea per section, 150 to 250 words each.

Add what a video cannot: exact numbers, short quotes, steps someone can copy, the caveats and edge cases. Cut everything that exists only to hold a viewer: teasers, "stick around", recaps.

End with the answer restated in one line and one next action.$q$,
 '["script","expand"]'::jsonb,'["article"]'::jsonb,'Articles',true,36)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
-- Projects that already have skills got their starters before these existed;
-- give them their own copies, after whatever they already have. A project
-- with no skills yet receives them with the other starters on first read.
INSERT INTO "project_skills" ("project_id","catalog_slug","catalog_version","name","when_to_use","instructions","surfaces","formats","enabled","customized","sort_order")
SELECT p."id", c."slug", c."version", c."name", c."when_to_use", c."instructions", c."surfaces", c."formats", true, false,
  coalesce((SELECT max(s."sort_order") + 1 FROM "project_skills" s WHERE s."project_id" = p."id"), 0)
    + CASE WHEN c."slug" = 'skimmable-sections' THEN 1 ELSE 0 END
FROM "projects" p
CROSS JOIN "skill_catalog" c
WHERE c."slug" IN ('chapters-that-hold','skimmable-sections')
  AND EXISTS (SELECT 1 FROM "project_skills" s WHERE s."project_id" = p."id")
ON CONFLICT ("project_id","catalog_slug") DO NOTHING;
