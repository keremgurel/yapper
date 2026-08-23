CREATE TABLE "project_brain_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_id" uuid NOT NULL,
	"ord" integer DEFAULT 0 NOT NULL,
	"heading" text DEFAULT '' NOT NULL,
	"text" text NOT NULL,
	"char_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"catalog_slug" text,
	"catalog_version" integer,
	"name" text NOT NULL,
	"when_to_use" text DEFAULT '' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"surfaces" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"customized" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"kind" text DEFAULT 'skill' NOT NULL,
	"name" text NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"when_to_use" text DEFAULT '' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"surfaces" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_brain_blocks" ADD COLUMN "rows" jsonb;--> statement-breakpoint
ALTER TABLE "project_brain_blocks" ADD COLUMN "digest" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_brain_blocks" ADD COLUMN "usage" text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_brain_blocks" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project_brain_blocks" ADD COLUMN "source_label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_brain_blocks" ADD COLUMN "source_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_brain_blocks" ADD COLUMN "char_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "project_brain_chunks" ADD CONSTRAINT "project_brain_chunks_block_id_project_brain_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."project_brain_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_skills" ADD CONSTRAINT "project_skills_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_brain_chunks_block_idx" ON "project_brain_chunks" USING btree ("block_id","ord");--> statement-breakpoint
CREATE INDEX "project_skills_project_idx" ON "project_skills" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "project_skills_catalog_unique" ON "project_skills" USING btree ("project_id","catalog_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_catalog_slug_unique" ON "skill_catalog" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "skill_catalog_browse_idx" ON "skill_catalog" USING btree ("published","sort_order");--> statement-breakpoint
-- Existing sections keep their meaning: one the creator hid from the AI becomes
-- private, everything else becomes routable.
UPDATE "project_brain_blocks" SET "usage" = CASE WHEN "in_context" THEN 'auto' ELSE 'private' END;--> statement-breakpoint
UPDATE "project_brain_blocks" SET "char_count" = length("body") + coalesce((
	SELECT sum(length(item))::integer FROM jsonb_array_elements_text("items") AS item
), 0);
--> statement-breakpoint
-- The catalog ships stocked, so the shelf is never empty on a fresh install.
-- ON CONFLICT DO NOTHING because after launch the admin surface owns these
-- rows, and a redeploy must not overwrite an edit someone made in production.
INSERT INTO "skill_catalog" ("slug","version","kind","name","tagline","when_to_use","instructions","surfaces","category","published","sort_order") VALUES
('hook-shapes',1,'skill','Eight hook shapes',
 $q$A menu of openers, so the first line is chosen rather than defaulted to.$q$,
 $q$Writing or rewriting the first line of a video, or generating hook variants.$q$,
 $q$Pick the shape that fits the idea, then write the line inside it. Never blend two shapes into one hook.

1. The number that should not be true: lead with the figure, no setup. "I spent 400 dollars to make 12."
2. The correction: name the advice everyone repeats, then break it in the same breath.
3. The confession: something you got wrong, stated flatly, no hedging.
4. The mid-scene open: start at the most interesting second of the story and backfill later.
5. The direct address: name exactly who this is for, by situation and not by demographic.
6. The stakes question: a question the viewer cannot answer and now needs to.
7. The visual claim: say the thing the camera is about to prove.
8. The comparison: two options on screen, one obviously better, no preamble.

Rules for every shape: under 12 words where possible, no "in this video", no "let me explain", no greeting. The first word carries weight, so never open on "so", "okay" or "hey". If the hook could sit on any account in the niche, it is not finished.$q$,
 '["hooks","ideate","script"]'::jsonb,'Hooks',true,10),

('contrarian-open',1,'skill','The contrarian open',
 $q$Open by disagreeing with the thing the audience already believes.$q$,
 $q$The idea has a widely held assumption underneath it that is worth attacking.$q$,
 $q$Find the belief the audience holds that is quietly costing them, and open by contradicting it in one clean sentence.

Structure: state the common belief in their words, reject it, then earn the rejection immediately with a concrete reason or a number. Do not save the evidence for the end; a contrarian open that stays unproven for 20 seconds reads as bait.

Constraints: attack the idea, never the people who hold it. Do not manufacture a contrarian take on something the creator does not actually disagree with, and do not use this shape twice in one week of content. If the strongest honest version is "it depends", pick a different skill.$q$,
 '["hooks","ideate"]'::jsonb,'Hooks',true,20),

('storytime-three-acts',1,'skill','Storytime, three acts',
 $q$A story that keeps its ending, told in the shape short form rewards.$q$,
 $q$The idea is a personal story, a case study, or anything with a before and an after.$q$,
 $q$Three acts, and the proportions matter more than the beats.

Act one, roughly 15 percent: drop the viewer into the scene at the moment something went wrong. No date, no background, no "so a few years ago". Establish who and what is at stake in two sentences.

Act two, roughly 60 percent: what you tried, in order, and what each attempt cost. Every attempt must fail in a different way, otherwise cut it. This is where retention is won, so keep the sentences short and the specifics real: names, numbers, times of day.

Act three, roughly 25 percent: the turn, then the transferable lesson in one line. The lesson is stated once and never repeated.

Never open with the moral. Never end with "so yeah". If the story has no cost, it has no act two, and it is a fact rather than a story.$q$,
 '["script","expand"]'::jsonb,'Script',true,30),

('problem-agitate-solve',1,'skill','Problem, agitate, solve',
 $q$The oldest structure in persuasion, kept honest.$q$,
 $q$Content aimed at a specific pain the audience already feels, especially anything leading to an offer.$q$,
 $q$Name the problem in the audience's own words, in one sentence, with no abstraction. Then make it concrete: what it actually costs them this week, stated as a scene rather than an adjective. Then the solution, as the smallest real step they could take today.

Proportions: problem 20 percent, agitation 30 percent, solution 50 percent. Most creators invert this and spend the whole video on the problem.

Honesty rules that override the structure: never invent a cost, never imply the problem is worse than it is, and never let the agitation run longer than the solution. If the solution is the creator's paid offer, say so plainly in the last five seconds rather than hiding it in the middle.$q$,
 '["script","expand","caption"]'::jsonb,'Script',true,40),

('show-dont-say',1,'skill','Show it, do not say it',
 $q$Turn a claim into something the camera proves.$q$,
 $q$The idea is a claim, a result, or a technique that could be demonstrated instead of described.$q$,
 $q$For every claim in the script, ask what the camera could show that would make the sentence unnecessary, and cut the sentence.

Write the script as a sequence of demonstrations with the fewest words that make each one legible. The words exist to point at what is happening, not to narrate it: "watch the left one" beats "as you can see, the left example demonstrates".

Practical rules: the demonstration starts inside the first three seconds, not after a setup. One idea per demonstration. If a step cannot be shown, it is either a caption or it is cut. End on the result held on screen in silence rather than on a summary of the result.$q$,
 '["script","ideate"]'::jsonb,'Script',true,50),

('retention-beats',1,'skill','Retention beats every seven seconds',
 $q$Something changes often enough that leaving never becomes the easy option.$q$,
 $q$Any script over 30 seconds, especially a talking head with no natural visual change.$q$,
 $q$Plan a change roughly every seven seconds. A change is any of: a new claim, a location or framing cut, a number appearing, a prop entering, a question asked, a tone drop, or the sentence rhythm breaking.

Write the script so the changes fall on meaning, never on a timer. A cut placed mid-thought to hit a beat reads as anxiety.

Two hard rules. The first change lands before second five, because that is where the decision to stay is made. And the last ten seconds get no new change at all: the payoff needs stillness to register, so everything competing with it gets removed.

Do not write stage directions into the script. Where a change is needed, make the words themselves turn.$q$,
 '["script"]'::jsonb,'Script',true,60),

('content-gap-filling',1,'skill','Content gap filling from search data',
 $q$Pick topics from what people search for and nobody answered well.$q$,
 $q$Choosing what to make next, especially when a content gap or search insights list is in the brain.$q$,
 $q$Work from the creator's gap or search data when it is present in their context. Do not invent search terms; if no gap list is loaded, say so and pick by another method rather than guessing at volume.

For each candidate gap, check three things before proposing it. Can this creator answer it from real experience, given what their brain says they make. Would their existing audience care, or does it only serve strangers. And is the gap real, meaning the existing answers are thin, rather than merely crowded.

Then write the idea in the searcher's words, not the industry's. The title should read like the phrase someone typed. Keep the gap phrase in the opening line so the video answers the question it was found by, and answer it inside the first fifteen seconds rather than teasing it.$q$,
 '["ideate","expand"]'::jsonb,'Ideas',true,70),

('keyword-led-topics',1,'skill','Keyword led topic picking',
 $q$Turn a keyword list into videos without sounding like an SEO page.$q$,
 $q$Choosing topics when the brain holds keyword research or a term list.$q$,
 $q$Use the loaded keyword rows as evidence of demand, never as copy. A keyword is a question someone asked badly; your job is to work out the real question and answer that.

Group the terms into intents before picking. Someone typing a how-to term wants a demonstration, a comparison term wants a verdict, and a problem term wants reassurance before instruction. One video serves one intent.

Write the title in natural speech. Never stuff the term, never repeat it, and never say it in a way the creator would not say out loud. If the term is awkward, the video still answers it; the phrasing does not have to match.

Prefer a cluster of three related terms answered properly in one video over three thin videos, unless the brain says the creator is building a series.$q$,
 '["ideate"]'::jsonb,'Ideas',true,80),

('comment-mining',1,'skill','Comment mining',
 $q$The next video is usually already written in the replies.$q$,
 $q$Generating ideas when the brain holds saved comments, questions, or audience quotes.$q$,
 $q$Treat a saved comment as a brief. The strongest ones are a question asked twice, a disagreement stated confidently, or a confession that starts "I thought I was the only one".

Turn one comment into one video. Quote the comment as the opening line where it is short enough to say out loud, because someone else's words in the first two seconds signal that this is a reply rather than a broadcast.

Answer the question actually asked, including the part underneath it. Someone asking which microphone to buy is usually asking whether their audio is why nobody watches.

Never mock the commenter, never use a comment that identifies a private person, and never invent a comment that was not saved.$q$,
 '["ideate"]'::jsonb,'Ideas',true,90),

('series-and-franchises',1,'skill','Series and franchises',
 $q$Build a format that can run twenty times instead of one good video.$q$,
 $q$The creator wants recurring content, or an idea is strong enough to repeat.$q$,
 $q$A franchise is a fixed frame with a variable inside it. Design the frame first: the same opening line, the same shape, the same length, one thing that changes each episode.

Test it before proposing it. Can you name ten episodes right now from the creator's brain and their pillars. If you cannot get to ten, it is a video and not a series.

Give it a name the audience can ask for, and number the episodes so a viewer can tell they missed one. Keep the opening line identical every time; that repetition is the whole asset, and varying it for freshness destroys the recognition it exists to build.

Say plainly how much work each episode is. A franchise the creator cannot sustain weekly is worse than no franchise.$q$,
 '["ideate"]'::jsonb,'Ideas',true,100),

('caption-that-earns-the-save',1,'skill','The caption that earns the save',
 $q$Write the caption for the person deciding whether to keep this.$q$,
 $q$Writing a caption or post copy for any platform.$q$,
 $q$The caption is not a summary. The video already said the thing; the caption gives the viewer a reason to keep it.

First line does the work, because everything after it is behind a "more" tap. Make it the sharpest claim, the missing step, or the specific case the video did not have time for.

Then at most two short lines of genuine addition. No recap, no "watch till the end", no emoji ladder, no hashtag wall. Hashtags only where the creator's brain says that platform rewards them, and then three at most.

End with one question that a person could answer from their own experience in a sentence. Never "thoughts?" and never a question the video already answered.$q$,
 '["caption"]'::jsonb,'Caption',true,110),

('icp-worksheet',1,'context','Who you are actually talking to',
 $q$A starting section for the one reader you write every video for.$q$,
 $q$Install when the audience field says something broad like "creators" or "founders".$q$,
 $q$Answer these in your own words. Write about one real person you have actually met or spoken to, not a segment.

Where they are right now: what they are trying to do this month, and what is in the way.
What they have already tried: the advice they have heard and why it did not work for them.
What they believe that is wrong: the assumption you keep having to undo.
What they would never say out loud: the embarrassing version of the problem.
How they talk: three phrases they use that an outsider would not.
What a win looks like to them this week, not this year.$q$,
 '[]'::jsonb,'Context',true,120)
ON CONFLICT ("slug") DO NOTHING;
