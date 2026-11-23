# What creators teach about yapping and talking to the camera

Research for Yapper, 23 November 2026 (Pacific). Written for two jobs: making the SEO framework library accurate, and giving the Brain / Ideas Lab skills real material to draw on. The skill drafts built from this are in [ideas-lab-skill-proposals-2026-11.md](ideas-lab-skill-proposals-2026-11.md).

## How this was gathered, and what it cannot see

Videos cannot be watched from here, so everything below comes from text: YouTube transcripts (pulled with `youtube-transcript-api` until YouTube blocked the box's IP after three videos), transcripts that third-party sites host for podcasts and videos, TikTok and Instagram post captions and TikTok "discover" pages as they appear in search, creator blogs, Instagram's own creator pages, X search, and teardown sites that transcribe creators' Reels and TikToks in bulk.

Limits worth knowing before relying on this:

- **TikTok and Instagram video pages mostly could not be fetched directly** (timeouts, login walls). Where a TikTok or Reel is cited, what was read is its caption or the summary TikTok/Instagram/search showed, not the spoken video.
- **Reddit threads only gave the original post.** Reddit blocks the fetcher and requires login for old.reddit and the JSON API, so comment advice is not included. The r/NewTubers and r/contentcreation posts are cited only as evidence of what people ask.
- **X was mostly noise** for this topic (UGC ad tooling, unrelated "yap" slang). One useful post is cited.
- **Some sources are vendors** (transcript tools, AI script tools, editors) writing SEO content about the same formats. They are marked _(vendor)_. They matter twice: as a source when they quote creators verbatim, and as competitors for the same search terms (see [§7](#7-what-this-means-for-seo)).
- Counts like "taught by 8 sources" mean the number of distinct sources in this file that teach the point. They show how common an idea is in what we found, not how well it works.

## 1. The short version

| #   | Framework or technique                                                        | Sources that teach it | One line                                                                                                                        |
| --- | ----------------------------------------------------------------------------- | --------------------: | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **No intro: the first line is the point**                                     |                    12 | No greeting, no "so", no "in this video". Open on the claim or the viewer's moment.                                             |
| 2   | **Talk to one person, not an audience**                                       |                    10 | Picture one friend behind the lens; say "you", never "hey guys".                                                                |
| 3   | **Outline, not a script** ("script the path, not every word")                 |                    10 | Memorize the first line, keep 2 to 4 beats, say the rest in your own words. Teleprompter is fine as a net.                      |
| 4   | **Reps beat talent** (film without posting, multiple takes, review one thing) |                     9 | Camera comfort is a trained skill. Five takes per posted video is normal for Jessi Jean.                                        |
| 5   | **Storytime: start in the action, turn, lesson**                              |                     9 | Open at the tensest moment, cut background, build to the turn, end on one usable line.                                          |
| 6   | **Hook, story, point(s)** (hook-story-lesson family)                          |                     8 | Hook states the topic, a story earns attention, then one or two points.                                                         |
| 7   | **Delivery: pause instead of filler, vary pace and pitch, end low**           |                     8 | Silence reads as confidence. Speed up some parts, slow down others, end sentences on a period.                                  |
| 8   | **Don't over-polish / over-edit**                                             |                     9 | Feeds reward real; cut dead air but keep breaths and the pauses that carry rhythm.                                              |
| 9   | **Strong take (and its "8 Mile" steelman form)**                              |                     7 | Take a side, defend it, name the opposite argument and knock it down.                                                           |
| 10  | **Spoken numbered list**                                                      |                     7 | Half of the yaps in two large teardowns say "number one" out loud. Best item last; each item gets an example.                   |
| 11  | **Captions on, hook text on screen**                                          |                     5 | Many watch muted. Put the hook in text at the top, captions lower down, and keep text, voice and picture saying the same thing. |
| 12  | **The ask lives in the caption, or nowhere**                                  |                     4 | Most top yaps just stop. One creator saw Reels improve after removing the CTA.                                                  |

Named frameworks from the brief, and how often short-form creators actually teach them:

| Framework                                        |              Creator sources teaching it _for talking-head video_ | Notes                                                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------: | -------------------------------------------------------------------------------------------------------- |
| Hook-story-lesson / hook-story-points            |                                                                 8 | The most common named shape in yapping advice.                                                           |
| Storytime beats                                  |                                                                 9 | Universal; mostly taught without a name.                                                                 |
| Strong take / hot take / 8 Mile                  |                                                                 7 | Oren John's core format.                                                                                 |
| Listicle (spoken list, "increasingly niche")     |                                                                 7 | Most common skeleton in transcript counts.                                                               |
| Small epiphany / relatable observation           |                                                                 3 | Oren John; Brock Johnson's "relatable hook".                                                             |
| Myth-bust (myth, truth, proof, fix)              |                                                                 3 | Mostly guides and tools; one research basis (Muller, already in `docs/video-scripting-research.md`).     |
| PAS (problem, agitate, solve) / problem-solution |                                                                 4 | Mostly UGC and ad scripting, not personal yaps.                                                          |
| Hook-Retain-Reward / Hook-Value-CTA              |                        2 primary (Hormozi; @butlermediamarketing) | Widely repeated by secondary sites.                                                                      |
| But / therefore story logic                      |        2 (Jenny Hoyos; Parker and Stone via our earlier research) | Short-form storytelling backbone.                                                                        |
| PREP                                             |                           0 creators; 2 speaking-coach/tool pages | Comes from speech training, not creator culture. Still a clean shape for answering a question on camera. |
| STAR                                             | 0 creators; only interview-prep Reels and LinkedIn writing guides | Nobody we found teaches STAR for yapping. A "STAR on camera" page is our own adaptation and must say so. |
| SCQA                                             |                                           0 creators; 1 tool page | Consulting framework. Fine for explainers, not something creators talk about.                            |
| Pixar story spine                                |                                                0 found this round | Keep it as a small library page only.                                                                    |

## 2. Structure frameworks

Each entry: the beats as taught, when to use it, a worked outline, and where it came from.

### 2.1 Hook, story, point one, point two (the Story Yap)

**Beats.** Hook (say what the video is about, ideally as a claim) → a story from your life or someone else's → point one → point two.

**When.** You have an opinion and an anecdote that proves it. This is the default for creators with a point of view.

**Example outline.**

1. Hook: "The best editing trick I learned this year is to stop editing."
2. Story: last month I spent four hours on a 40-second video, and it got half the views of one I cut in ten minutes.
3. Point one: viewers notice when you stop sounding like yourself.
4. Point two: cut dead air and flubs, then stop.

**Sources.** Oren John teaches it by name ("hook, story, point one, point two") in [The Art of Yapping](https://www.youtube.com/watch?v=CS0A4hJfcy4) and on [Cut30's guide](https://cut30.co/guides/how-to-yap) ("The Story Yap"). Variants: CreatorsCompanion's "Yapping" shape _(vendor)_: hook mid-thought, the gap, the epiphany, the lesson, closure that answers the opening frame ([page](https://www.creatorscompanion.app/tools/tiktok-script-generator)); Shannon McKinstrie's "Hook + Context + Meat & Potatoes", 0–2 s hook, 2–6 s context, 6–30 s the tip or story ([blog](https://shannonmckinstrie.com/lazy-pro-edit-how-to-talk-to-camera-on-instagram-and-actually-sound-like-you/)); ManyScripts' seven-line TikTok yap script built from 42 TikToks _(vendor)_ ([post](https://www.manyscripts.com/blog/how-to-yap-on-tiktok)); a Hook → Setup → Struggle → Solution → Outcome → Lesson → CTA reel shape in Instagram search summaries; @precious.lashae on TikTok: "Outline your video with a hook, conflict, and resolution" ([discover page](https://www.tiktok.com/discover/how-to-start-over-on-tiktok-and-become-famous)).

### 2.2 The six-move yap (what 84 Reels share)

**Beats.** (1) The line: one sentence, about 13 words, the claim or the viewer's own moment. (2) The mistake: what people do now and why it backfires, in second person. (3) The name: give the idea a name, letter or number. (4) The proof: a list, a short story with a number, or a named example. (5) The turn: the one sentence the viewer would repeat. (6) The exit: one instruction, a dare, or nothing; the sell goes in the caption.

**When.** Advice and educational yaps. This is the closest thing to a measured "default yap".

**Example outline.** "You don't need a script. You need four lines." / Most people write a page and read it, so they sound like a commercial. / I call it the four-line yap. / Your point, your first sentence word for word, two beats, your last line. / I went from 12 takes to 3 the week I switched. / Structure is what lets you sound unscripted. / Try it on your next video.

**Sources.** [ManyScripts, How to Yap: 84 talking-head Reels from 17 creators](https://www.manyscripts.com/blog/how-to-yap) _(vendor, but quotes transcripts of Oren John, Jessi Jean, Jun Yuh, Codie Sanchez, Dr. Becky, Alex Hormozi, Chris Do, Brian Mark)_. Jun Yuh's own shape per [ManyScripts' Jun Yuh teardown](https://www.manyscripts.com/blog/how-to-yap-like-jun-yuh): call-out, the real problem, a named framework, his story as proof, the ask. Jun Yuh's rule, quoted there: "Use the word you to call out what they want, but use the word I when you're highlighting the problems."

### 2.3 Storytime

**Beats.** Hook at the tensest moment or the ending first → only the background needed (who, where, what was at stake) → build-up with two or three specific details → the twist → the close: what you learned or would do differently. Split into parts if it runs long; end part one right after the twist.

**When.** Something happened to you (or a client) that has stakes and a turn.

**Example outline.** "I lost my best client in one email." / It was a Friday, I was tired, and I replied to the wrong thread. / What I tried next, and why each fix made it worse. / The turn: they came back six months later, because of how I apologized. / The lesson in one line.

**Craft notes from storytellers.**

- Matthew Dicks (five-time Moth GrandSLAM winner, _Storyworthy_): every story is about a "five-second moment" of change or realization; know that moment first, then "start the story by asking myself what is the opposite of the ending of the story" ([Art of Manliness interview](https://www.artofmanliness.com/social/social-skills/how-to-tell-better-stories/)). His "Homework for Life" practice (write down one moment from each day) is an idea-capture habit.
- Jenny Hoyos (YouTube Shorts, ~10M average views per Short at the time): visual hook → foreshadow → smooth transition (no "let's get started") → a body built from "but" and "therefore" → a last line she writes before filming ([Creator Science interview summary](https://moderncreator.app/2023-10-09-jay-clouse-shorts-genius-shares-everything-she-knows)). Story plus a twist is her "universal mechanism".
- Kindra Hall (_Stories That Stick_): Normal → Explosion → New Normal, and "familiarize, don't memorize" a story you present (seen in search results for her [blog](https://www.kindrahall.com/blog/effective-storytelling-in-presentations-familiarize-dont-memorize); not opened in full).

**Sources.** [Hop storytime guide](https://hopbot.io/en/blog/storytime-video-format) _(vendor)_: "Start at the tensest moment, not with the background", avoid "Let me tell you a story", tell it out loud once before filming, "film it without reading". [CreatorKitz story hook template](https://creatorkitz.com/templates/tiktok-hook-storytelling) _(vendor)_. Oren John's "story time" style ([video](https://www.youtube.com/watch?v=CS0A4hJfcy4)). Brock Johnson's storytelling hooks "use the word I: I almost quit blank. Last year, I was stuck at blank" ([1,300 hooks episode](https://exa.ai/library/podcast/h5w9bqvw70z/episode/3w217vgdqtz)). Shannon McKinstrie: practice on camera with "the story that comes up every time you're hanging with your friends" to find your natural voice. Yapper's existing `storytime-three-acts` skill already encodes the 15/60/25 proportions.

### 2.4 Strong take, and the "8 Mile" (steelman then the point)

**Beats.** Strong take: call something the best, worst, easiest or most overrated, then defend it. 8 Mile: strong-statement hook → call out the opposite argument (everything people would say against you) → the reason your opinion still holds. "Take into education" variant: open with the opinion, then pivot straight into the useful breakdown.

**When.** You genuinely hold a position. Good for comments and for building a point of view.

**Example outline.** "Teleprompters make most creators worse." / "Now you'll say: but I freeze without one." / Fair, and here's when it helps (exact wording, ads, nerves). / But reading a page flattens your voice, so use it for the first line and the must-say lines only.

**Sources.** Oren John, who names all three ([video](https://www.youtube.com/watch?v=CS0A4hJfcy4), [Cut30](https://cut30.co/guides/how-to-yap)). Digivizer: "Lead with the claim", apply the "so what" filter, "Close without recap" ([post](https://digivizer.com/blog/the-art-of-yapping-the-strategy-behind-talk-to-camera-video-content/)). Kallaway's "contrarian" hook format ([transcript](https://pickscribe.com/v/xnOe8aA9Pmw)). Brock Johnson's contrarian and bold-claim hooks. Jessi Jean: "Say the shit others are feeling and thinking, but won't say", and open with a flat claim; per ManyScripts, her question-first openers averaged 114 views a day against 205 ([teardown](https://www.manyscripts.com/blog/how-to-yap-like-jessi-jean-on-tiktok)). Cutroom's hot-take and unpopular-opinion format pages _(vendor)_: open on the take, one proof, acknowledge the strongest objection ([hot take](https://cutroomai.com/formats/hot-take)).

### 2.5 Small epiphany

**Beats.** A relatable observation ("Have you ever noticed that…") → the specific example → why it happens or what it says about us → a light landing.

**When.** You don't have a lesson, just a sharp noticing. Builds camaraderie fast.

**Sources.** Oren John ("small epiphany"; "strong takes, small epiphanies and story time is like the foundation for 90% of the content you can make"), Brock Johnson's "relatable hook" ("When you…", "POV: me when I…"), Cut30's "Try this: 'Have you ever noticed that…'".

### 2.6 The spoken list (and "10 things that get increasingly niche")

**Beats.** Say the number up front → each item with one reason or example → escalate (the niche version promises that items get stranger) → best or most surprising last.

**When.** Practical advice; also easiest to deliver without a script because each number is a re-entry point.

**Data.** 44 of 84 Reels and 21 of 42 TikToks say "number one/first/step one" out loud ([ManyScripts, 84 Reels](https://www.manyscripts.com/blog/how-to-yap); [42 TikToks](https://www.manyscripts.com/blog/how-to-yap-on-tiktok)). Jun Yuh's "10 out of 10 habits… increasingly more niche" Reel had 395,841 likes, the most in that set.

**Caveat.** Oren John pointedly does _not_ recommend generic lists: "I didn't say my top three favorite whatever… If you are thinking outside of that box and it's generic, it's not going to work." His own list format ("four things I saw at Coachella") is a list of strong takes. Jenny Hoyos calls a three-step list "the simplest universal" retention mechanism. Reconcile: a list is fine when every item is a take or a specific example, not filler.

**Sources.** ManyScripts (above), Jun Yuh, Jessi Jean (19 list videos), Oren John, Jenny Hoyos, Brock Johnson ("list hooks"), Tyche Labs list shape ([guide](https://www.tychelabs.net/guides/how-to-film-short-form-talking-video)) _(vendor)_.

### 2.7 Myth-bust

**Beats.** Name the belief → why it sounds right → the truth → one proof (number, test, result) → what to do instead. End on the truth, never the myth.

**Sources.** Tyche Labs "Myth: common belief, why it is wrong, what to do" ("You don't need a ring light. You need a window."); Cutroom myth-bust format _(vendor)_ ([page](https://cutroomai.com/formats/myth-bust)); Derek Muller's misconception research (already summarized in `docs/video-scripting-research.md`: refuting a misconception improved learning, d = 0.71).

### 2.8 Problem → solution (PAS family)

**Beats.** As creators teach it, it is usually Hook → problem/solution → (product) → value → CTA. Sydney Mohni, after "over 1,000 UGC scripts": hook (first 3–5 s), problem/solution, introduce the product, value props, CTA ([TikTok](https://www.tiktok.com/@sydneynicoleugc/video/7468805955388673326)). Tyche Labs' "Tip: problem, fix, result". A talking-head prompt guide lists "problem, solution, proof" as the typical arc ([acluebox](https://acluebox.com/blog/tiktok-talking-head-script-prompt-template-guide)) _(vendor)_.

**When.** Anything that leads to an offer. For personal yaps, creators prefer to bury the product in a story: Jessi Jean names her course in 31 videos "almost never as a pitch".

**Note.** Yapper already ships `problem-agitate-solve` in the catalog with honesty rules. Research agrees with its "solution gets the most time" proportion.

### 2.9 Hook → Retain → Reward (and Hook → Value → CTA)

**Beats.** Alex Hormozi's "content unit": "Hook gets them interested, retain keeps them interested, and then reward rewards them for their time and attention" ([short transcript](https://hormozis.de/en/library/Txse9UTu_pc/)). @butlermediamarketing's "HVC Framework: a Hook, Value and Call To Action" ([TikTok discover page](https://www.tiktok.com/discover/how-to-create-video-reels?lang=en)).

**Use.** A check, not a script: every beat must keep earning the next.

### 2.10 But / therefore

Jenny Hoyos builds every Short's body from "but" (conflict) and "therefore" (consequence), from Parker and Stone's rule against "and then". Already in Yapper's long-form writer (`chapters-that-hold`). Short-form skills should use it too.

### 2.11 PREP, STAR and SCQA: borrowed, not native

- **PREP** (point, reason, example, point) shows up only on speaking-coach and tool pages, for example [NoShotList](https://noshotlist.com/guides/how-to-talk-on-camera-without-a-script) _(vendor)_: "one point, one opening line, two beats, one ending" and "a 45–60 second talking video says its point in the first sentence, backs it up with a reason and an example, then makes one ask". It maps well to _answering a viewer's question_.
- **STAR** appears on Instagram almost only as interview prep ([@arunkmac](https://www.instagram.com/arunkmac/reel/DHhs8JVCkiv/), [@jito_jobs](https://www.instagram.com/jito_jobs/reel/DD-HWf1i9_D/)) and in LinkedIn post guides. No talking-head creator we found teaches it. Our adaptation (situation, task, action, result, plus the lesson) is still useful for case studies, "how I got X" and founder updates.
- **SCQA** only on a tool page ([ishort](https://ishort.pro/reel-script-frameworks.html)) _(vendor)_.

## 3. Hook patterns

**Hard rules that recur.**

- No greeting. 0 of 84 Reels greet the audience ([ManyScripts](https://www.manyscripts.com/blog/how-to-yap)). Jun Yuh: "No one is watching your videos with a group of friends. So stop saying, hey guys or hi everyone." Vinh Giang stops a student mid-take: "don't start with so because so is a filler word" ([video](https://www.youtube.com/watch?v=6-shbSFc48E)).
- Length. Brock Johnson's study of 1,300 viral Reels: the average viral hook was 7.7 words, best between five and eight, and performance fell off past 12 words ([episode](https://exa.ai/library/podcast/h5w9bqvw70z/episode/3w217vgdqtz)). ManyScripts' median first sentence is 13 words on both Instagram and TikTok.
- A complete thought. Each top opener "states the claim or names the exact situation, and the rest of the Reel earns it" (ManyScripts).
- Align the spoken line, on-screen text and first visual. Kallaway: misalignment between what you say and what is on screen weakens the hook. Brock Johnson calls on-screen text "totally unrelated to what is visually going on in the reel" a common mistake. Instagram's own guide suggests stacking a question in the first frame and an answer a few seconds later ([About Instagram](https://about.instagram.com/blog/tips-and-tricks/how-to-make-instagram-reels)).
- Explain fast. Nicholas Crown added intros that explain "in under 3 seconds what they are about to watch" to old Reels for non-followers ([Instagram for Creators](https://creators.instagram.com/blog/nicholas-crown-reels-success-story/)).

**Pattern catalogs taught by creators.**

| Brock Johnson, 15 hook types from 1,300 Reels                                                                                                                                                                                                                                                                                                                                                                   | Kallaway, 6 hook formats                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 pattern interrupt, 2 contrarian, 3 curiosity gap, 4 outcome-based, 5 direct address / call-out, 6 storytelling ("I almost quit…"), 7 hook swap (rework a proven viral hook), 8 authority / data, 9 bold claim, 10 relatable ("When you…", meme POV), 11 POV (filmed from the viewer's view), 12 urgency / time-bound, 13 list, 14 comparison (before/after), 15 identity ("Disciplined entrepreneurs never…") | Fortune teller (present vs future), Experimenter (peer-to-peer demo), Teacher (lesson framing), Magician (a visual or verbal "stun gun", e.g. "check this out", used with the others), Investigator (a secret or finding), Contrarian. Kallaway's writing recipe: context lean → scroll-stop interjection ("but", "however") → contrarian snapback. Source: [transcript](https://pickscribe.com/v/xnOe8aA9Pmw), [BuildOS analysis](https://build-os.com/blogs/source-analyses/kallaway-irresistible-hooks). |

**Data points on openers** (pattern-level, from ManyScripts' count of Jessi Jean's 93 TikToks; small groups, treat as hypotheses): flat claim beats a question (205 vs 114 views/day); describing the viewer's inner feeling helped (240 vs 179); opening with "If you…" (157 vs 209) and "Good morning, I'm in Chicago" location openers (125 vs 205) did worse.

**Mapping to Yapper.** The 10 hook patterns already in the product (Contrarian claim, Stop doing X, Stakes first, Mid-action cold open, Specific-number proof, POV framing, Named enemy, Curiosity gap with a payoff, Credential flash, Direct-address callout) plus the `hook-shapes` skill cover most of this. Gaps the research suggests: **identity hook**, **small-epiphany / relatable observation**, **fortune teller (what's about to change)**, **comparison**, and an explicit **text-hook vs spoken-hook pair**.

## 4. Delivery and on-camera technique

### 4.1 Talk to one person

Taught by Jun Yuh ("Treat the Camera Like a Friend", [Reel](https://www.instagram.com/jun_yuh/reel/DHkj2vqO_qT/)), Jessi Jean ("You are talking to this person right here"), Vic Barry ("stop talking to the camera… picture one specific viewer", [summary](https://moderncreator.app/2023-08-04-vic-barry-get-better-at-talking-on-camera-in-10-minutes)), Ali Abdaal ("coffee mode", [summary](https://rosetta.to/u/aliabdaal/how-to-be-confident-on-camera-5-tips)), Shannon McKinstrie ("FaceTiming with a friend we trust"), Cut30 ("as if you were answering a thoughtful question"), @aplussocials ("Pretend that you have somebody in the room with you", [TikTok](https://www.tiktok.com/@aplussocials/video/7660161925359160590)), Brian Brewer and others on [TikTok's "how to speak naturally" page](https://www.tiktok.com/discover/how-to-speak-naturally-in-front-of-camera), NoShotList ("have someone ask you the questions"). **10 sources.**

### 4.2 Where to look (the one real disagreement)

- **Lens.** Vic Barry: look down the actual lens, not the flip screen. Jun Yuh: "Smile and Maintain Eye Contact". Vinh Giang coaches "hold eye contact with the camera… the camera symbolizing another person". Oren John's Recut method keeps eye contact until he stops talking.
- **Off-lens is fine.** @aplussocials (podcast-style UGC): "do not look at the camera when you are talking". Aron Sōgi (camera coach, on TikTok's discover page): angle your body "as if a friend is sitting beside you… Looking away and glancing back creates that authentic vibe". NoShotList: either works if consistent.
- **Pressure valves.** Sunglasses (Shannon McKinstrie; Vic Barry citing Casey Neistat). Screen-mirroring to check framing (@ambersharniece, [Reel](https://www.instagram.com/reel/DU_fwrSD6i_/)).
  **7 sources.** Teach both: lens for direct advice, a friend beside the camera for conversational or podcast-style yaps.

### 4.3 Voice: pace, pitch, volume, pause

- Vinh Giang's five elements: rate of speech (vary it), volume ("level five"), pitch (end sentences on a lower pitch), tonality ("the emotion that lives underneath your words"), and pausing ([43-minute video](https://www.youtube.com/watch?v=6-shbSFc48E)).
- Jessi Jean: "Talk quicker than you likely do in real life and drop your tone"; "end my sentences with a period instead of a question mark"; speed up parts and have "the restraint to slow down other areas".
- Measured pace: TikTok yaps run a median **215 words a minute** (42 TikToks from Oren John, Jessi Jean, Jun Yuh, Dr. Becky), against ~150 in conversation ([ManyScripts](https://www.manyscripts.com/blog/how-to-yap-on-tiktok)). Our long-form writer assumes 130–170, which is right for YouTube but slow for TikTok yaps.
- Vic Barry: avoid monotone; project 25–30% louder than conversation.
  **8 sources across voice points.**

### 4.4 Filler words and pauses

Replace "um" with silence: Vinh Giang (powerful pauses), Vic Barry (re-record clean rather than edit around ums; kill crutch words like "so"), a [Wispim guide](https://wispim.com/blog/how-to-stop-saying-um-on-camera) _(vendor)_ (know your next point; a one-second silence reads as confidence). Oren John's **Recut method**: stay quiet whenever you need to think or check a note, keep looking at the lens until you stop, then cut every silence afterwards. "You might end up with a six or seven minute clip… but allows you to think." That is exactly what Yapper's one-click silence cut is for.

### 4.5 Energy and nerves

- Raise energy: Ali Abdaal's "presenter mode", speak through a smile, warm up (music, movement). Shannon McKinstrie: only record in a good mood. Oren John: "be excited, be passionate… if they look like they're not having fun… it's probably not going to do very well."
- Lower it when anxious: Jessi Jean, "If you're feeling anxious, lower your energy. Take a few deep breaths… calm, clear, and direct before trying to be clever."
- The cause of freezing, per Aron Sōgi: "attention split" between the message and the lens.
- Hands: Ali Abdaal (use them, within a natural range), Vinh Giang (keep hands above the table; grow your "gesture vocabulary"), Vic Barry (not constant), Brian Brewer (hold something).

### 4.6 Reps, review and recording modality

- Film without posting: "The number one thing that got me over my fear of being on camera was to film with ZERO intention of posting" ([TikTok discover](https://www.tiktok.com/discover/how-to-stop-being-afraid-recording-at-home)). Ali Abdaal: send video messages to friends.
- Review one thing at a time: Vinh Giang, record weekly and ask "What is one thing I can do better next week?" for ten weeks ([blog](https://vinhgiang.com/blog/how-to-be-less-awkward-sound-more-natural-on-camera)).
- Takes: Jessi Jean averages "at least FIVE TAKES per posted video" (over 1,075 recorded in 11 months); Shannon McKinstrie, three takes minimum, "Cringey comes before it clicks"; a 30-day "no planning, just winging it" challenge Reel argues "authority isn't built through perfect delivery… It's built through clarity, repetition, and reps" ([Reel](https://www.instagram.com/reel/DTkQZHEjZiy/)).
- **Redo the opening at the end.** Oren John: you are most awkward at the start and warmest after three minutes, so re-record the intro once or twice. NoShotList: memorize only the first sentence.
- One take vs many clips: "Some people need MOMENTUM… Other people need PROCESSING TIME" (@shinewithnatasha, [Reel](https://www.instagram.com/reel/DRUp_kdjEe0/)). Break a hard sentence "into natural chunks and allow a cut in between" (@contentbycaley, [TikTok](https://www.tiktok.com/@contentbycaley/video/7329346184395443499)). Aron Sōgi calls the mix of script/bullets/free talk, sitting/standing/walking and where you look your "recording modality", and says to experiment before deciding you are bad on camera.
- Think Media Podcast (Sean Cannell and a keynote-speaker guest): a teleprompter "counts" while you build up, start small, and "It is a gift to be invisible at first" ([episode](https://www.youtube.com/watch?v=LyubV66bwgk)).
  **9 sources.**

### 4.7 Scripts, bullets and teleprompters

- Bullet points / loose outline: Jun Yuh ("Use an Outline"), Vic Barry, Cut30 ("Script the path, not every word… If a sentence feels difficult to remember, simplify the thought instead of rehearsing it harder"), Shannon McKinstrie ("80% of the creators making yap videos that are doing well use a loose script or bullet points"), NoShotList (four lines: point, first line, two beats, ending; full script only for ads, compliance and prices), Jenny Hoyos ("rough script or bullet points"), Jessi Jean ("sticky notes all around my phone").
- Teleprompters: Instagram's own Edits app ships one; @omgadrian: "I used to spend hours perfecting my delivery, and memorizing line after line" ([Edits tutorial](https://creators.instagram.com/edits/tutorials/teleprompter)). A TikTok broadcaster account: "you can absolutely use a script and still sound like yourself" by making delivery "feel like a conversation, not a presentation".
- Write it yourself: Jessi Jean, "stop using AI to write your scripts. You sound like a robot", but use AI for ideas and tightening. This is the line Yapper's script writer has to walk; `write-like-a-person` already exists for it.
  **10 sources.**

### 4.8 Formats of the yap itself (Oren John / Cut30)

Standard yap (sitting, phone at eye level, captions), walking or car yap (more candid, more variables; "never record while driving"), graphic yap (a useful visual roughly every two seconds; "every graphic should explain or prove something"), notebook yap (anchor words on a whiteboard, never a full script).

## 5. Authenticity and not over-editing

- **The platform says raw wins.** Instagram head Adam Mosseri: "Flattering imagery is cheap to produce and boring to consume. People want content that feels real", and creators should move toward "a more raw aesthetic" ([Business Insider](https://www.businessinsider.com/instagram-head-ai-images-polished-feed-dead-adam-mosseri-2026-1)).
- **Casual raises the bar on structure.** Connor Pugs on X: yap-style videos "look easy, but many people who try them get stuck at 100 views… the casual nature of the video raises the bar significantly for your hook, tonality, and overall structure" ([post](https://x.com/REALConnorPugs/status/2123474579683205449)). This is Yapper's positioning in one sentence: natural delivery, real structure.
- **Cut dead air, keep the person.** Hiroska _(vendor)_: gaps between thoughts (over ~1.5 s) are dead, cut them; gaps inside a thought (under ~0.5 s) are rhythm, keep them; never cut the breath before a sentence; keep the "um" that signals care before a number; alternate a 10–15% punch-in to hide jump cuts; "never a dissolve"; a loose talking head tightens 20–30% from silences alone, and 50% means you are eating rhythm ([guide](https://hiroska.com/blog/cut-the-ums-out-of-a-recording)). Tyche Labs: remove every flub and its restart, shorten pauses to a breath, end within a second of the last word.
- **The counter-view.** Shannon McKinstrie removes "every 'um,' every pause, every dead second" for punch. The two views reconcile on short-form: cut dead pauses hard, keep breaths and intra-sentence rhythm.
- **Imperfection is a feature.** Jun Yuh ("Embrace Imperfection… Small flaws make you relatable"), Ali Abdaal ("embrace imperfection"; casual over fake-professional), Jessi Jean keeps her status low ("I'm not a content guru") while speaking with certainty; ManyScripts counted her self-lowering videos at 248 vs 179 views/day.
- **No CTA, or a quiet one.** Nicholas Crown removed CTAs from Reels and they "performed significantly better" ("People don't want to leave the platform"). Most of ManyScripts' 84 Reels just stop; the keyword ask sits in the caption.
- **Graphics must earn their place.** Oren John: every visual should "clarify the point, prove the claim, or reset attention".
  **9 sources.**

## 6. What this means for the product (not just content)

These are observations for Can, not shipped changes.

1. **Recut method = Yapper's one-click edit.** Creators already record with long thinking pauses and rely on an editor to remove them. The teleprompter + one-click cut can be sold exactly this way: "pause as long as you need, look back at the lens, keep talking; we cut the silences."
2. **"Redo the opening at the end"** could be a recorder prompt: after a long take, offer "record your first line again?"
3. **Editor defaults that match the research:** cut gaps over ~1.5 s, review 0.5–1.5 s, keep breaths, offer per-instance filler keep/remove, alternate punch-in on jump cuts.
4. **Outline mode for the teleprompter.** Many creators want four lines, not a page. A teleprompter view that shows only the first line plus 2–4 beat cues fits "structured but not scripted".
5. **Pace targets by platform.** TikTok yaps run ~215 wpm; the script length estimate could offer "TikTok pace" next to the 150 wpm default.
6. **Delivery feedback after a take** (wpm, filler count, longest pause, where energy dropped) would turn Vinh Giang's "one thing to fix next time" into a feature. This is a product idea, not a skill; skills only shape writing and chat.

## 7. What this means for SEO

- **Competitors are already building format libraries.** ManyScripts runs a whole "how to yap" cluster: [how-to-yap](https://www.manyscripts.com/blog/how-to-yap), how-to-yap-on-tiktok, "how to yap like" teardowns for Oren John, Jessi Jean, Jun Yuh, Codie Sanchez, Dr. Becky, Hormozi/Brian Mark, and yap-script-templates. Virlo has `/tiktok-formats/` pages (storytime, hot-takes, pov, talking-head, tutorial…). Cutroom has `/formats/` pages (hot-take, unpopular-opinion, myth-bust). Cut30 owns a "how to yap" guide. This validates the plan's framework library and says we are not early.
- **Yapper's angle that they lack:** each format page can end in a real workflow (capture → script with that structure → teleprompter → one-click cut), and our pages can carry delivery and editing advice, not just a script template.
- Keyword numbers for new ideas are in the [topical authority plan, §13](../topical-authority-plan-2026-11.md#13-creator-research-23-november-2026).

## 8. Source list

Primary creator sources (their own words: video transcript, caption, blog or interview):

1. Oren John (@orenmeetsworld), _The Art of Yapping_ — https://www.youtube.com/watch?v=CS0A4hJfcy4 (transcript read in full)
2. Cut30 (Oren John's program), _How to Yap on Camera_ — https://cut30.co/guides/how-to-yap
3. Jun Yuh, "How to be confident on camera" Reel caption — https://www.instagram.com/jun_yuh/reel/DHkj2vqO_qT/
4. Vinh Giang, blog — https://vinhgiang.com/blog/how-to-be-less-awkward-sound-more-natural-on-camera
5. Vinh Giang, _43 minutes straight of SOLID communication skills advice_ — https://www.youtube.com/watch?v=6-shbSFc48E (transcript read)
6. Ali Abdaal, _How to Be Confident on Camera (5 Tips)_ — https://rosetta.to/u/aliabdaal/how-to-be-confident-on-camera-5-tips (hosted transcript)
7. Vic Barry, _Get Better at Talking On-Camera in 10 Minutes_ — https://moderncreator.app/2023-08-04-vic-barry-get-better-at-talking-on-camera-in-10-minutes
8. Think Media Podcast (Sean Cannell), _How to Instantly Be Better on Camera_ — https://www.youtube.com/watch?v=LyubV66bwgk (transcript read)
9. Brock Johnson, _I Studied 1,300 Hooks_ (Build Your Tribe ep. 877) — https://exa.ai/library/podcast/h5w9bqvw70z/episode/3w217vgdqtz
10. Kallaway (Kane Kallaway), _I Studied 100 Viral Hooks, These 6…_ — https://pickscribe.com/v/xnOe8aA9Pmw
11. Jenny Hoyos on Creator Science with Jay Clouse — https://moderncreator.app/2023-10-09-jay-clouse-shorts-genius-shares-everything-she-knows
12. Alex Hormozi, content unit (Hook, Retain, Reward) — https://hormozis.de/en/library/Txse9UTu_pc/ (YouTube Txse9UTu_pc)
13. Shannon McKinstrie, _Lazy Pro Edit: How to Talk to Camera on Instagram_ — https://shannonmckinstrie.com/lazy-pro-edit-how-to-talk-to-camera-on-instagram-and-actually-sound-like-you/
14. Matthew Dicks on The Art of Manliness — https://www.artofmanliness.com/social/social-skills/how-to-tell-better-stories/
15. @shinewithnatasha, "One vs multiple clips" Reel — https://www.instagram.com/reel/DRUp_kdjEe0/
16. @ambersharniece, screen-mirroring Reel — https://www.instagram.com/reel/DU_fwrSD6i_/
17. "Day 1 of 30 of recording content with no planning" Reel — https://www.instagram.com/reel/DTkQZHEjZiy/
18. Instagram Edits teleprompter tutorial, feat. @omgadrian — https://creators.instagram.com/edits/tutorials/teleprompter
19. @aplussocials on TikTok — https://www.tiktok.com/@aplussocials/video/7660161925359160590
20. @contentbycaley on TikTok — https://www.tiktok.com/@contentbycaley/video/7329346184395443499
21. TikTok discover, "how to speak naturally in front of camera" (Aron Sōgi, Brian Brewer and others) — https://www.tiktok.com/discover/how-to-speak-naturally-in-front-of-camera
22. TikTok discover, "how to stop being afraid recording at home" — https://www.tiktok.com/discover/how-to-stop-being-afraid-recording-at-home
23. @sydneynicoleugc (Sydney Mohni) on TikTok — https://www.tiktok.com/@sydneynicoleugc/video/7468805955388673326
24. TikTok discover, "how to create video reels" (@butlermediamarketing HVC) — https://www.tiktok.com/discover/how-to-create-video-reels?lang=en
25. TikTok discover, "how to start over on TikTok" (@precious.lashae) — https://www.tiktok.com/discover/how-to-start-over-on-tiktok-and-become-famous
26. Connor Pugs on X — https://x.com/REALConnorPugs/status/2123474579683205449
27. Nicholas Crown, Instagram for Creators case study — https://creators.instagram.com/blog/nicholas-crown-reels-success-story/
28. Adam Mosseri via Business Insider — https://www.businessinsider.com/instagram-head-ai-images-polished-feed-dead-adam-mosseri-2026-1
29. Instagram, _How to make Instagram Reels: the complete 2026 guide_ — https://about.instagram.com/blog/tips-and-tricks/how-to-make-instagram-reels
30. Kindra Hall blog (search result only) — https://www.kindrahall.com/blog/effective-storytelling-in-presentations-familiarize-dont-memorize

Teardowns, guides and vendors (useful, but second-hand or selling a tool):

31. ManyScripts, _How to Yap: 84 talking-head Reels_ — https://www.manyscripts.com/blog/how-to-yap
32. ManyScripts, _How to Yap on TikTok: 42 TikToks_ — https://www.manyscripts.com/blog/how-to-yap-on-tiktok
33. ManyScripts, _How to Yap Like Jessi Jean on TikTok (93 scripts)_ — https://www.manyscripts.com/blog/how-to-yap-like-jessi-jean-on-tiktok
34. ManyScripts, _How to Yap Like Jun Yuh_ — https://www.manyscripts.com/blog/how-to-yap-like-jun-yuh
35. Digivizer, _The Art of 'Yapping'_ — https://digivizer.com/blog/the-art-of-yapping-the-strategy-behind-talk-to-camera-video-content/
36. Hop, _Storytime on TikTok_ — https://hopbot.io/en/blog/storytime-video-format
37. CreatorsCompanion, TikTok script generator ("Yapping" shape) — https://www.creatorscompanion.app/tools/tiktok-script-generator
38. Tyche Labs, _How to film a talking video for Reels, TikTok and Shorts_ — https://www.tychelabs.net/guides/how-to-film-short-form-talking-video
39. Hiroska, _How to cut the ums and pauses out of a recording_ — https://hiroska.com/blog/cut-the-ums-out-of-a-recording
40. NoShotList, _How to Talk on Camera Without a Script_ — https://noshotlist.com/guides/how-to-talk-on-camera-without-a-script
41. Cutroom format pages (hot take, myth-bust) — https://cutroomai.com/formats/hot-take
42. CreatorKitz, TikTok story hook template — https://creatorkitz.com/templates/tiktok-hook-storytelling
43. acluebox, TikTok talking-head script prompt guide — https://acluebox.com/blog/tiktok-talking-head-script-prompt-template-guide
44. Wispim, _How to stop saying um on camera_ (search summary) — https://wispim.com/blog/how-to-stop-saying-um-on-camera
45. Virlo TikTok formats index — https://virlo.ai/tiktok-formats

Demand signals only (question posts; comments could not be read):

46. r/NewTubers, "Scripting vs Talking off the Cuff" — https://www.reddit.com/r/NewTubers/comments/1vlujb3/scripting_vs_talking_off_the_cuff/
47. r/NewTubers, "Tips for presenting to a camera" — https://www.reddit.com/r/NewTubers/comments/1oph12j/tips_for_presenting_to_a_camera/
48. r/contentcreation, "how do people talk to the camera so easily" — https://www.reddit.com/r/contentcreation/comments/1so2z15/how_do_people_talk_to_the_camera_so_easily/

Internal: `docs/video-scripting-research.md` (MrBeast memo, George Blackman, Derek Muller, Parker and Stone, Paddy Galloway, Jenny Hoyos).
