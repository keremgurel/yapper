# Ideas Lab skill proposals from the creator research

Drafted 23 November 2026 (Pacific). Source material: [creator-yapping-best-practices-2026-11.md](creator-yapping-best-practices-2026-11.md). **These are specs in a doc. Nothing here has been added to the catalog, a migration, or the app.** Shipping any of them is Can's call.

## 1. How skills actually work in Yapper today

Read from the repo at `697aa003` (main, 23 November 2026).

- **Where they live in the product.** The sidebar's **Lab** group holds Brain and Ideas (`src/data/studio-nav.ts`). Skills are a tab on the Brain page (`src/components/brain/skills/`). "Browse skills" opens the catalog sheet, the shelf, grouped by `category` ("Ways of writing you can hand to the AI. Adding one takes a copy you own and can rewrite.").
- **Two tables** (`src/lib/db/schema.ts`):
  - `skill_catalog`: the shelf. `slug` (unique), `version`, `kind` (`skill` or `context`), `name`, `tagline`, `when_to_use`, `instructions`, `surfaces` (jsonb), `formats` (jsonb), `category`, `published`, `sort_order`. Kept in the database so prompt text can be edited without a deploy.
  - `project_skills`: a creator's installed or self-written copy. Same text fields plus `catalog_slug`, `catalog_version`, `enabled`, `customized`. Installing copies the text; editing a catalog entry bumps `version`, which offers an update, and asks first if the creator customized their copy.
- **Fields and limits** (`src/lib/brain/skill-input.ts`): name 80 chars, `whenToUse` 200, tagline 140, slug 60 (`a-z0-9-`), category 40, instructions 10,000.
- **Surfaces** (`brainSurfaces`): `ideate`, `hooks`, `script`, `caption`, `expand`, `chat`, `capture`. Empty means all. **Formats** (`VERSION_FORMATS`): `short`, `long`, `article`. Empty means all.
- **How a skill reaches a prompt** (`docs/brain-architecture.md`, `src/lib/brain/context/`): every enabled skill gets one INDEX line (its `whenToUse`) in every prompt. A small router model reads the INDEX and picks what to LOAD for the task, up to **3 skills** (`MAX_LOADED_SKILLS`); with four or fewer routable items it loads them all; if the router fails, word-overlap rules decide. Loaded text shares a per-surface budget: **script 2,600 chars, expand 2,600, ideate 2,200, hooks 1,600, caption 900, chat 3,000, capture 0**. A skill that does not fit is dropped whole. So **`whenToUse` is the routing key, and instructions should stay under about 1,000 characters** or they crowd each other out. Every draft below is 620 to 980 characters.
- **Always-on.** `write-like-a-person` skips routing and is read on every writing call (`always-on.ts`). New skills must not fight it: no em dashes, no "not X, but Y", no stage directions in scripts.
- **Starters.** New projects get `write-like-a-person`, `hook-shapes`, `storytime-three-acts`, `show-dont-say`, `caption-that-earns-the-save`, `chapters-that-hold`, `skimmable-sections` (`src/lib/brain/default-skills.ts`).
- **Already on the shelf** (migrations 0019, 0030, 0031): Eight hook shapes, The contrarian open, Storytime three acts, Problem agitate solve, Show it do not say it, Retention beats every seven seconds, Content gap filling, Keyword led topic picking, Comment mining, Series and franchises, The caption that earns the save, Who you are actually talking to (context), Chapters that hold, Skimmable sections, Write like a person. **PAS and storytime already exist**, so this doc proposes a v2 for storytime and leaves PAS alone.
- **Two ways to ship an entry.** (a) The catalog admin at `/studio/admin/skills` (Clerk ids in `ADMIN_USER_IDS`) creates and edits entries with no deploy. **But the admin input does not accept `formats`** (`SkillCatalogInput` has no `formats` field), so an entry limited to `short` needs (b) a migration in the style of `drizzle/0019_plain_molten_man.sql` / `0030_format_skills.sql`, with `ON CONFLICT ("slug") DO NOTHING`, or a small admin change.

## 2. The proposals at a glance

| Skill                            | Slug                    | Status            | Category | Surfaces              | Formats     | Chars | Backs SEO page                                                                                                                     |
| -------------------------------- | ----------------------- | ----------------- | -------- | --------------------- | ----------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------- |
| The yap                          | `the-yap`               | new               | Script   | script, expand        | short       |   929 | How to structure a talking-head video (pillar); a new "How to yap" page.                                                           |
| Hook, story, lesson              | `hook-story-lesson`     | new               | Script   | script, expand, hooks | short, long |   748 | Hook-story-lesson framework page (plan week 6); feeds the structure pillar.                                                        |
| Storytime, three acts            | `storytime-three-acts`  | update (v1 to v2) | Script   | script, expand        | all         |   870 | Storytime structure page (plan week 10).                                                                                           |
| Strong take, then the other side | `strong-take`           | new               | Script   | script, hooks, ideate | short       |   780 | Strong take / "8 Mile" (steelman then the point) library page; strong take vs small epiphany vs storytime styles page.             |
| Small epiphany                   | `small-epiphany`        | new               | Ideas    | ideate, hooks, script | short       |   732 | Strong take / small epiphany / storytime styles page; "talking head video ideas" sections.                                         |
| A list said out loud             | `spoken-list`           | new               | Script   | script, hooks         | short       |   768 | Listicle / countdown library page; "increasingly niche" format section.                                                            |
| Myth, then the truth             | `myth-then-truth`       | new               | Script   | script, expand        | short, long |   621 | Myth-bust library page.                                                                                                            |
| STAR on camera                   | `star-on-camera`        | new               | Script   | script, expand        | short, long |   722 | STAR on camera page (titled for video storytelling, not interviews).                                                               |
| Answer in PREP                   | `prep-answer`           | new               | Script   | script, caption, chat | short       |   709 | PREP for talking-head videos page (plan week 5).                                                                                   |
| Four lines, not a script         | `four-line-outline`     | new               | Script   | script                | short, long |   720 | How to talk on camera without a script; video script template page; talk-to-camera pillar.                                         |
| Written to be said               | `written-for-the-mouth` | new               | Writing  | script, hooks         | short, long |   840 | How to sound natural reading a script (section of the talk-to-camera pillar); teleprompter feature page.                           |
| On-camera coach                  | `camera-coach`          | new               | Delivery | chat                  | all         |   977 | How to talk to the camera naturally (pillar); eye contact with camera; how to stop saying um on camera (with SpeakingPractice.ai). |
| Yap map                          | `yap-map`               | new               | Ideas    | ideate, chat          | all         |   752 | Never lose a content idea (plan week 7); talking head video ideas.                                                                 |

Not proposed, on purpose:

- **PAS.** `problem-agitate-solve` already exists and matches what creators teach (solution gets the most time).
- **SCQA, Pixar story spine, AIDA as skills.** No creator we found teaches them for talking-head videos. They can stay as library pages that send people into `the-yap` or `hook-story-lesson`.
- **Hook patterns.** `hook-shapes` and `contrarian-open` already cover most of the 15 hook types creators teach. Suggested later edit to `hook-shapes` (v2): add _identity_ ("Disciplined founders never…"), _fortune teller_ (what is about to change) and _small epiphany_ openers, and the rule that on-screen text, the spoken line and the first frame say the same thing.
- **Editing as a skill.** Skills shape writing and chat. Editing advice (keep breaths, cut gaps over about 1.5 s, alternate punch-ins) belongs in editor defaults; see §6 of the research doc.

Suggested starter changes, if Can likes them: add `the-yap` and `four-line-outline` to `STARTER_SKILL_SLUGS`. Together they answer the two things Can asked for: structure, and not sounding scripted.

## 3. The specs

Each spec uses the real catalog fields. "Inputs" and "Output shape" are what the skill expects the surface to have and what the generated text should look like; they are notes for review, not columns.

### The yap (`the-yap`)

- **Status:** new
- **Category / sort_order:** Script / 25
- **Tagline:** One idea, said to one person, with just enough shape to land.
- **whenToUse:** Writing a short talking-head video that gives advice, an opinion or a lesson, when no other structure fits better.
- **Surfaces:** `["script", "expand"]` **Formats:** `["short"]`
- **Inputs:** The idea and any notes or inspiration transcript on it; the creator's Essentials and voice (read anyway as CORE).
- **Output shape:** A short script in six beats, about 130 to 280 spoken words: line, mistake, name, proof, turn, exit.
- **Backs SEO page:** How to structure a talking-head video (pillar); a new "How to yap" page.
- **Instructions** (929 characters):

```text
Write it as one person talking to one viewer about one idea. Six beats, in this order.

1. The line. One sentence, 13 words or fewer, with the claim or the exact moment the viewer is in. No greeting, no "so", no "in this video".
2. The mistake. What people do now and why it backfires, said to "you".
3. The name. If the idea deserves one, name it in a few words and define it in one sentence. Skip this beat rather than invent a gimmick.
4. The proof. A short story from the creator's own notes with a number or a date in it, or a spoken list of two or three items, each with one reason.
5. The turn. The one line a viewer would repeat to a friend.
6. The exit. One small instruction, or nothing. Put any offer or comment keyword in the caption, not the script.

Use "you" for what the viewer wants and "I" for the mistakes and the proof. Keep sentences short enough to say in one breath. Stop on the turn or the exit; no recap.
```

### Hook, story, lesson (`hook-story-lesson`)

- **Status:** new
- **Category / sort_order:** Script / 28
- **Tagline:** Say the point, earn it with a story, leave one thing they can use.
- **whenToUse:** The idea has a real anecdote behind it, from the creator or someone they can name, and a point the story proves.
- **Surfaces:** `["script", "expand", "hooks"]` **Formats:** `["short", "long"]`
- **Inputs:** The idea, the anecdote in the creator's notes or capture, any inspiration transcript.
- **Output shape:** Hook line, story (2 to 4 beats), then one or two points or a single lesson line.
- **Backs SEO page:** Hook-story-lesson framework page (plan week 6); feeds the structure pillar.
- **Instructions** (748 characters):

```text
Three parts. The hook says what the video is about as a claim, in under 13 words, so the story has something to prove.

The story comes straight after, with no "let me tell you a story". Use the creator's real anecdote from their notes, or a named person's. Two to four beats, each joined by "but" or "so", never "and then". Keep one concrete detail per beat: a name, a number, a place, what was said.

Then the lesson. Either one line the viewer can use today, or two short points that each start with why the hook is true ("It's the best because…"). Do not restate the story.

If there is no real story in the creator's material, say so and suggest the yap or a spoken list instead. Never invent an anecdote or put words in a real person's mouth.
```

### Storytime, three acts (`storytime-three-acts`)

- **Status:** update (v1 to v2)
- **Category / sort_order:** Script / 30
- **Tagline:** A story that keeps its ending, told in the shape short form rewards.
- **whenToUse:** The idea is a personal story, a case study, or anything with a before and an after.
- **Surfaces:** `["script", "expand"]` **Formats:** `[]`
- **Inputs:** The story in the creator's notes or a voice capture.
- **Output shape:** Three acts, about 15 / 60 / 25 percent, with a turn and a one-line lesson; a Part 1 split when it runs long.
- **Backs SEO page:** Storytime structure page (plan week 10).
- **Instructions** (870 characters):

```text
Find the moment the story is about first: the few seconds where something changed or the creator realized something. Everything else exists to make that moment land.

Act one, about 15 percent: open at the tensest second, or say the ending first. No date, no "so a few years ago". Two sentences on who and what was at stake. Start from the opposite of where the story ends: if it ends in trust, open in doubt.

Act two, about 60 percent: what happened, in order, joined by "but" and "so", never "and then". Each attempt fails in a different way or it is cut. Real specifics: names, numbers, what was said.

Act three, about 25 percent: the turn, then the lesson in one line, stated once.

If it needs more than about 200 words, write Part 1 ending right after the turn. Never open with the moral. Never end with "so yeah". No cost, no act two: it is a fact, not a story.
```

### Strong take, then the other side (`strong-take`)

- **Status:** new
- **Category / sort_order:** Script / 45
- **Tagline:** Take a side, name the best argument against it, and still win.
- **whenToUse:** The creator genuinely holds an opinion that people in their niche would push back on.
- **Surfaces:** `["script", "hooks", "ideate"]` **Formats:** `["short"]`
- **Inputs:** The opinion and the creator's reasons from their notes; their Essentials so the take fits what they believe.
- **Output shape:** Take line, the objection in the audience's words, the answer, the reason, and where the take does not apply.
- **Backs SEO page:** Strong take / "8 Mile" (steelman then the point) library page; strong take vs small epiphany vs storytime styles page.
- **Instructions** (780 characters):

```text
Open with the take as a flat statement: something is the best, the worst, overrated, or wrong. No "I think", no question.

Then say the strongest objection the way a skeptic in the comments would say it ("Now you're going to say…"). Answer it with one concrete reason, number or example.

Give the real reason the take holds, then say plainly where it does not apply. That one honest limit is what separates a take from rage bait.

End on the take restated in different words, or on a two-option question people can answer in one word.

Only write takes the creator's notes or Essentials support. If the honest answer is "it depends", say the idea needs a different skill. Attack ideas, never people. Use the existing "contrarian open" skill for the first line if it is installed.
```

### Small epiphany (`small-epiphany`)

- **Status:** new
- **Category / sort_order:** Ideas / 95
- **Tagline:** A sharp everyday noticing that makes viewers say "I do that too".
- **whenToUse:** Generating ideas from the creator's day, or the idea is an observation rather than advice or a story.
- **Surfaces:** `["ideate", "hooks", "script"]` **Formats:** `["short"]`
- **Inputs:** Captured notes, voice memos, the day's moments; the creator's pillars.
- **Output shape:** As ideas: 3 to 5 observations each with a one-line take. As a script: noticing, example, why it happens, landing.
- **Backs SEO page:** Strong take / small epiphany / storytime styles page; "talking head video ideas" sections.
- **Instructions** (732 characters):

```text
Look for something small and specific the creator noticed that their audience also does, sees or feels but has not put into words.

Open with the noticing in the viewer's terms: "Have you noticed that…", "Every [person] does this one thing…". Then one precise example, described like a scene. Then why it happens or what it says about us, in one or two sentences. Land lightly: a callback, a confession that the creator does it too, or a question.

It must be true and specific. "People are busy" is not an epiphany; "We all say 'quick question' and then ask three" is.

When generating ideas, pull from the creator's own captured notes and moments first, and attach a take to each: what they like, dislike or would change about it.
```

### A list said out loud (`spoken-list`)

- **Status:** new
- **Category / sort_order:** Script / 55
- **Tagline:** Numbered points that each earn their place, best one last.
- **whenToUse:** Practical advice with three to seven separate items, or a ranked or "increasingly niche" list.
- **Surfaces:** `["script", "hooks"]` **Formats:** `["short"]`
- **Inputs:** The idea and the items in the creator's notes.
- **Output shape:** Hook with the number, then items as "Number one… Two… Three…", each with one reason or example, strongest last.
- **Backs SEO page:** Listicle / countdown library page; "increasingly niche" format section.
- **Instructions** (768 characters):

```text
Say the number in the first line so the viewer knows how far they are from the end: "Three things I check before every client call."

Every item is spoken as "Number one", "Two", "Three", so anyone who drifts off can rejoin. Each item gets one reason or one real example in a sentence or two. An item with no reason or example is cut.

Order for payoff: a strong item first, the most surprising or most useful one last. For an "increasingly niche" list, say so in the first line and make each item more specific or stranger than the last.

Each item should be a take or a specific, not a generic tip anyone could list. Three to five items for a short; seven at most. No recap of the items at the end; stop after the last one, or add one line on which one to try first.
```

### Myth, then the truth (`myth-then-truth`)

- **Status:** new
- **Category / sort_order:** Script / 58
- **Tagline:** Name the belief, show why it fails, and give the better move.
- **whenToUse:** The idea corrects a common belief or piece of advice in the creator's niche.
- **Surfaces:** `["script", "expand"]` **Formats:** `["short", "long"]`
- **Inputs:** The belief, the creator's evidence or experience against it.
- **Output shape:** Myth, why it sounds right, the truth, one proof, what to do instead.
- **Backs SEO page:** Myth-bust library page.
- **Instructions** (621 characters):

```text
Five beats. State the myth in the words people actually use, and say straight away that it is wrong. Explain in one or two sentences why it sounds right, so the viewer does not feel stupid for believing it. State the truth plainly. Back it with one proof from the creator's material: a number, a test they ran, a result, or something they watched happen. Then the better move, as one thing to do next.

End on the truth or the action, never on the myth, so the wrong idea is not the last thing remembered. Do not invent statistics or studies; if the creator has no proof, use their direct experience and say it is theirs.
```

### STAR on camera (`star-on-camera`)

- **Status:** new
- **Category / sort_order:** Script / 61
- **Tagline:** Situation, task, action, result, turned into a story people watch.
- **whenToUse:** Telling how the creator or a client got a specific result: a case study, a win, a founder update, or a career story.
- **Surfaces:** `["script", "expand"]` **Formats:** `["short", "long"]`
- **Inputs:** The result, what was at stake, and the steps taken, from notes or a voice capture.
- **Output shape:** Result-first hook, situation, task, action (2 to 3 decisions), result with a number, one lesson.
- **Backs SEO page:** STAR on camera page (titled for video storytelling, not interviews).
- **Instructions** (722 characters):

```text
This is the interview method rebuilt for video. Lead with the result, because nobody waits for it on camera: "We went from 12 to 140 bookings in a month."

Then the four beats, short. Situation: where things stood, in one or two sentences with one real detail. Task: what had to happen and why it mattered to the creator. Action: two or three decisions they made, each with the reason, including one that did not work. Result: the number again, or what changed, plus the cost.

Close with one lesson the viewer can apply, stated once. Write it in first person and plain speech. No "the situation was", no beat labels read out loud, no job-interview phrasing. Never inflate the result or add steps the creator did not take.
```

### Answer in PREP (`prep-answer`)

- **Status:** new
- **Category / sort_order:** Script / 63
- **Tagline:** A clear answer to one question in under a minute.
- **whenToUse:** Answering a specific question from a comment, a DM or a client, or any idea phrased as a question.
- **Surfaces:** `["script", "caption", "chat"]` **Formats:** `["short"]`
- **Inputs:** The question (ideally quoted from a saved comment), the creator's answer in their notes.
- **Output shape:** Quote of the question, point, reason, example, point again or one action. 60 to 150 words.
- **Backs SEO page:** PREP for talking-head videos page (plan week 5).
- **Instructions** (709 characters):

```text
Open by saying the question the way it was asked, if it is short enough to read out ("Someone asked how long a cover letter should be."). Then answer it immediately in one sentence: that is the point.

Reason: the single most important why, in a sentence or two. Example: one real case from the creator's notes or experience, with a detail that makes it believable. Point: say the answer again in fresh words, or turn it into one thing to do.

Answer the question asked, including the worry under it. Do not hedge the point into "it depends" unless it truly does; if it does, name the one deciding factor. Never quote a comment that identifies a private person, and never invent a question that was not asked.
```

### Four lines, not a script (`four-line-outline`)

- **Status:** new
- **Category / sort_order:** Script / 26
- **Tagline:** An outline you can say from memory, so you sound like yourself.
- **whenToUse:** The creator prefers to talk from notes, says scripts make them stiff, or asks for an outline or bullet points instead of a script.
- **Surfaces:** `["script"]` **Formats:** `["short", "long"]`
- **Inputs:** The idea and any draft script; the creator's stated preference (Essentials) for bullets over full scripts.
- **Output shape:** Four or five lines: the point, the first sentence word for word, two or three beat cues of 3 to 6 words, the last sentence word for word.
- **Backs SEO page:** How to talk on camera without a script; video script template page; talk-to-camera pillar.
- **Instructions** (720 characters):

```text
Write an outline the creator can glance at once and then say in their own words.

Line 1, the point: the one thing the viewer should remember, as a sentence the creator could say.
Line 2, the first sentence, word for word. This is the only line worth memorizing.
Lines 3 to 4 (or 5), the beats: three to six words each, a cue rather than a sentence ("the $400 shoot", "why the window wins"). Each beat holds one example or reason.
Last line, the final sentence word for word, so the creator knows where to stop.

Keep any exact wording that must be exact (prices, offer terms, legal lines) written out in full and flagged. If a beat needs a long sentence to make sense, the thought is too complicated. Simplify the idea.
```

### Written to be said (`written-for-the-mouth`)

- **Status:** new
- **Category / sort_order:** Writing / 6
- **Tagline:** Scripts that sound like talking when read off a teleprompter.
- **whenToUse:** Writing or editing any script that will be read from the teleprompter or said on camera.
- **Surfaces:** `["script", "hooks"]` **Formats:** `["short", "long"]`
- **Inputs:** The draft script; the creator's spoken examples (voice set) if present.
- **Output shape:** The same script, rewritten line by line for speech. No stage directions.
- **Backs SEO page:** How to sound natural reading a script (section of the talk-to-camera pillar); teleprompter feature page.
- **Instructions** (840 characters):

```text
Every line will be spoken, so write for the ear.

One idea per sentence. Most sentences under 15 words, with a few longer ones so it does not sound clipped. Contractions always. Numbers the way they are said ("four hundred dollars", "half"). Words the creator would use across a table, never ones they would only write.

End statements on a full stop, not a rising question, unless it is a real question. Put the most important word at the end of its sentence, where the voice naturally lands.

Read each line as if out loud. If it is hard to say in one breath, split it. If it has a clause in the middle, move it to the end or cut it.

Do not add stage directions, pauses or delivery notes in brackets; the words themselves carry the rhythm. When the creator's own spoken examples are in the brain, match their sentence length and phrases.
```

### On-camera coach (`camera-coach`)

- **Status:** new
- **Category / sort_order:** Delivery / 130
- **Tagline:** Practical help with nerves, eye contact, pace and filler, one fix at a time.
- **whenToUse:** The creator asks for help talking to the camera: freezing, sounding stiff, nerves, eye contact, filler words, energy or how to practice.
- **Surfaces:** `["chat"]` **Formats:** `[]`
- **Inputs:** The creator's question in chat; their Essentials; any notes they have kept on past takes.
- **Output shape:** A short reply: the likely cause, one fix to try on the next take, and one practice drill. Not a list of 10 tips.
- **Backs SEO page:** How to talk to the camera naturally (pillar); eye contact with camera; how to stop saying um on camera (with SpeakingPractice.ai).
- **Instructions** (977 characters):

```text
Coach like a friend who has filmed a thousand takes. Diagnose first: most stiffness comes from performing for an audience instead of talking to one person, or from not knowing the next line.

Give one fix for the next take, chosen from what fits their problem:
- Picture one specific friend behind the lens and say "you".
- Memorize only the first line; talk from three beat cues.
- When you lose the thread, stop, stay silent, look back at the lens and carry on. The silence gets cut.
- Replace "um" with a pause; end sentences on a full stop.
- Too flat: speak a little louder and faster than at a table. Anxious: breathe and start lower.
- Eye contact: the lens for advice; a friend beside the camera for a chattier style.
- Re-record the opening at the end of the session, when you are warm.

Then one drill: a take not meant for posting, a video message to a friend, or rewatch and pick one thing to fix next week. Never promise results or diagnose anxiety as a condition.
```

### Yap map (`yap-map`)

- **Status:** new
- **Category / sort_order:** Ideas / 75
- **Tagline:** Turn what happened today into three to five ideas, each with a take.
- **whenToUse:** The creator asks what to post, has nothing planned, or has captured notes from their day.
- **Surfaces:** `["ideate", "chat"]` **Formats:** `[]`
- **Inputs:** Recent captured ideas, voice notes and inspiration links; pillars; Essentials.
- **Output shape:** Three to five ideas, each: the moment it came from, the take in one line, and the best-fitting format (strong take, small epiphany, storytime, answer, list).
- **Backs SEO page:** Never lose a content idea (plan week 7); talking head video ideas.
- **Instructions** (752 characters):

```text
Mine the creator's own recent material before inventing anything: captured notes, voice memos, saved links, questions from their work, things that annoyed or surprised them, media they reacted to, and thoughts from walks or the shower.

Return three to five ideas. For each one give the moment it came from (quote the note if short), the take in one line ("I like this and here's why", "this is overrated", "I wish this worked differently"), and the format that fits best: strong take, small epiphany, storytime, answer a question, or a spoken list.

An idea without a take is not ready; say what take is missing rather than making one up. Favor ideas the creator can say from real experience. Keep each one to two or three lines so they can pick fast.
```

## 4. Which skill backs which SEO page

The rule from the plan still holds: a framework page may only say "use this in Yapper" where the thing exists. If these skills ship, each page below can end with "Add the [skill] skill in Brain and write your next script with it", which is honest and converts better than a generic script-writer link.

| SEO page (plan item, or new from this research)                          | Skill(s) it would link to                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| How to structure a talking-head video (pillar, week 1)                   | `the-yap`, `four-line-outline`                               |
| How to talk to the camera naturally (pillar, week 2)                     | `camera-coach`, `four-line-outline`, `written-for-the-mouth` |
| Turn an inspiration video into your own script (week 3)                  | `the-yap`, `hook-story-lesson`                               |
| PREP for talking-head videos (week 5)                                    | `prep-answer`                                                |
| Hook-story-lesson (week 6)                                               | `hook-story-lesson`, existing `hook-shapes`                  |
| Never lose a content idea (week 7)                                       | `yap-map`, `small-epiphany`                                  |
| STAR on camera (week 9)                                                  | `star-on-camera`                                             |
| Storytime structure (week 10)                                            | `storytime-three-acts` v2                                    |
| Strong take / small epiphany / storytime styles; Steelman then the point | `strong-take`, `small-epiphany`                              |
| Listicle / countdown                                                     | `spoken-list`                                                |
| Myth-bust                                                                | `myth-then-truth`                                            |
| PAS                                                                      | existing `problem-agitate-solve`                             |
| New: How to yap (on camera)                                              | `the-yap`, `four-line-outline`, `camera-coach`               |
| New: Video script templates (yap templates)                              | `the-yap`, `hook-story-lesson`, `spoken-list`, `prep-answer` |
| New: Eye contact with the camera                                         | `camera-coach`                                               |

## 5. Before shipping

1. Run each new skill through `scripts/chirpy-eval` (there is a `studio-brain-skill-off` case) and a few real ideas, and check the router picks the right one from `whenToUse` when 10+ skills are installed.
2. Decide the `formats` question: either a migration, or add `formats` to the catalog admin.
3. For `storytime-three-acts` v2, editing the catalog entry bumps its version; creators who customized their copy are asked first. Check the update prompt wording before pushing a starter skill change to everyone.
4. Keep the instructions under about 1,000 characters each after any edits, so three skills still fit the 2,600-character script budget.
