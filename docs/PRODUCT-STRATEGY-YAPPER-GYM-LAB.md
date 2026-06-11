# Yapper Product Strategy — Gym + Lab

_Last updated: 2026-06-10_

## Core thesis

Yapper should not be framed as a generic AI speaking coach, public-speaking tips app, teleprompter, or AI content writer.

The unique angle is:

> Yapper turns yapping into a trainable content skill.

The product has two connected modes:

1. **Gym** — improve speaking through reps, scoring, and runbacks.
2. **Lab** — turn saved inspiration and content pillars into talking-head videos users can record, improve, lightly edit, and publish.

The broader product loop is:

> Save → Study → Structure → Speak → Improve → Post

This is the novel workflow Yapper should own.

---

## Why this matters

A lot of modern creator content looks casual: someone talking to the camera like they are on FaceTime with a friend.

But high-performing "off-the-cuff" yapping is usually not truly off the cuff. It is a technical skill built through:

- repeated speaking reps
- saved inspiration
- recurring formats
- content pillars
- hooks
- loose structure
- pacing
- retakes
- editing
- feedback loops

Yapper should make that invisible skill visible, trainable, and repeatable.

---

## Positioning

### Primary positioning

> Yapper is the content gym for talking-head creators.

### Demo-friendly positioning

> Yapper turns your saved videos into structured yaps you can record, improve, and post.

### Sharp tagline candidates

- Stop saving videos. Start yapping them.
- Practice speaking like reps, not lessons.
- The speaking gym for people who ramble.
- Turn saved inspiration into recorded talking-head posts.
- Build the skill behind “casual” creator videos.

---

## Mode 1: Yapper Gym

The Gym is for improving the underlying speaking skill.

### Jobs to be done

- Improve public speaking
- Improve storytelling
- Reduce rambling
- Become clearer under time pressure
- Practice interviews, pitches, explanations, and opinions
- Build confidence speaking without a perfect script

### Core mechanic: reps

The Gym should treat speaking like lifting weights.

Users should not just consume lessons. They should do reps.

A rep loop:

1. User gets a prompt or chooses a scenario.
2. User speaks for a fixed time window.
3. Yapper transcribes and scores the response.
4. Yapper identifies one specific fix.
5. User runs it back.
6. Yapper shows improvement.

### Signature feature: The Runback

The Runback is the key product mechanic.

Instead of giving a long feedback report, Yapper gives one diagnosis and one correction, then makes the user try again.

Example:

> Your point was unclear. Run it back, but this time lead with the conclusion.

Why it matters:

- creates visible progress
- makes feedback actionable
- gives videos a satisfying before/after demo
- turns practice into a habit loop

### Possible Gym modes

- **First Rep** — speak cold for 60 seconds
- **Cleaner Rep** — redo a messy answer with one fix
- **Pressure Rep** — less prep time, harder prompt
- **Roast Rep** — blunt feedback on rambling, filler, weak structure
- **Story Rep** — turn a boring detail into an interesting story
- **Interview Rep** — answer realistic questions under pressure
- **Pitch Rep** — explain a product, idea, or project clearly

### Score dimensions

Potential scorecard:

- clarity
- structure
- specificity
- filler words
- pacing
- confidence
- rambling
- hook quality
- ending strength
- “did you actually say anything?”

The score should not feel academic. It should feel like a coach giving useful, slightly sharp feedback.

---

## Mode 2: Yapper Lab

The Lab is for creators who post talking-head social videos.

It is not a generic script generator. It is a creator workflow for turning inspiration into recorded output.

### Core insight

Everyone saves content. Almost nobody turns it into output.

Creators already save Instagram Reels, TikToks, YouTube Shorts, tweets, clips, hooks, and examples. The problem is that saved inspiration usually dies in folders.

Yapper Lab should turn that passive save behavior into active creation.

### Core Lab workflow

1. User adds content pillars.
2. User connects or uploads inspiration sources.
3. Yapper transcribes and analyzes saved videos/content.
4. Yapper extracts formats, hooks, ideas, structures, and angles.
5. User gets suggested yap ideas.
6. User chooses bullets or a full script.
7. User records in-app.
8. Yapper gives performance feedback.
9. Yapper optionally cuts silences, adds captions, and prepares the post.
10. User posts or cross-posts to platforms.

### Signature feature: Save Folder Brain

The Save Folder Brain is the Lab’s novel input layer.

Concept:

> Connect your saved videos/links. Yapper studies what you save and turns it into ideas you can actually record.

Instead of asking the user, “What do you want to create?”, Yapper can say:

> Based on what you’ve been saving, here are 5 videos you could yap about today.

Each suggested idea can include:

- hook
- 3 bullet structure
- reference clips
- borrowed format
- suggested angle
- full script option
- recording prompt
- performance notes

### Inspiration sources

Potential sources to support over time:

- pasted Instagram Reel links
- pasted TikTok links
- pasted YouTube Shorts links
- uploaded videos
- manually saved links
- creator examples
- user’s content pillars
- app share-sheet imports from TikTok/Instagram/YouTube where supported
- login/connect flows for TikTok or Instagram if they unlock useful creator/source context
- ideally, direct Instagram saved-folder import if technically/platform feasible

Note: direct Instagram saved-folder integration may be constrained by platform/API limits. The product should not depend on this being available at launch. Pasted links, uploads, manual collections, and mobile share-sheet capture are enough for an MVP.

### Inspiration Inbox

The Lab should include a dedicated **Inspiration** tab that acts like a private swipe file plus analysis engine.

Ways to add inspiration:

1. **Share into Yapper**
   - User taps Share on TikTok, Instagram, YouTube, or another platform.
   - Yapper appears in the native share sheet where supported.
   - The shared URL lands directly in the Inspiration tab.

2. **Paste into Yapper**
   - The app has an always-accessible `+` icon.
   - User pastes any link.
   - Yapper automatically detects whether the link is a TikTok, Instagram Reel, Instagram user/profile, YouTube Short, long-form video, tweet/X post, or generic webpage.
   - Yapper categorizes the source accordingly.

3. **Optional account connection**
   - Login/connect with TikTok or Instagram can be explored if it gives useful access to user context, posting, profile metadata, or easier importing.
   - This should be treated as an enhancement, not the MVP dependency, because platform access can be fragile.

What gets saved with each inspiration item:

- original URL
- platform/source type
- creator/account name if detectable
- title/caption/description if available
- transcript when possible
- extracted hook
- core topic
- structure/format
- tone/style notes
- user-added context
- related content pillar
- possible Yapper ideas generated from it

User-added context matters. Sometimes the user saves a video not because of the topic, but because of the format, delivery, hook, editing, or emotional angle. Yapper should let users add a note like:

> I like the way she starts with a personal contradiction here.

or

> Use this format for product-building updates.

### Automatic pillar mapping

During onboarding, users should define their content pillars.

Examples:

- building in public
- AI tools
- fitness progress
- founder lessons
- speaking practice
- immigrant/career story
- product updates

When a user adds inspiration, Yapper should automatically map it to the most relevant pillar, with the option to override.

The system should analyze:

- what the video/post is about
- why it likely worked
- what content format it uses
- what pillar it maps to
- how the user could adapt it without copying

This creates a compounding creator brain: the more the user saves, the better Yapper understands their taste, pillars, and repeatable formats.

### Creator output formats

The Lab should support talking-head posts that look casual but are actually structured:

- FaceTime-style yaps
- opinion takes
- educational mini-lessons
- story-based posts
- reaction/response posts
- “here’s something I realized” posts
- product/build-in-public updates
- niche advice videos

### Recording support

Yapper should support both loose and structured speaking:

- bullet-point mode
- full-script mode
- prompt-only mode
- hook-first mode
- teleprompter-lite mode
- runback mode after recording

The goal is not to make users sound scripted. The goal is to make them sound clear while preserving the casual yap style.

### Light editing

Potential lightweight editing features:

- cut silences
- remove long pauses
- add captions
- clean filler segments where possible
- export platform-ready clips
- one-click or assisted cross-posting

Editing should support the core loop, not become the whole product. Yapper is not trying to out-CapCut CapCut.

---

## Category differentiation

Yapper should combine three workflows that are usually separate:

1. **Inspiration library** — saves, references, links, pillars
2. **Idea/script structure** — hooks, bullets, creator formats
3. **Speaking practice + publishing** — record, feedback, edit, post

Competitor/tool alternatives usually own only one slice:

- Notion stores ideas
- ChatGPT writes scripts
- CapCut edits clips
- teleprompters help users read
- social schedulers post
- speech coaches give feedback

Yapper’s ownable loop:

> Save → Study → Structure → Speak → Improve → Post

---

## Market proof / creator references

Kerem flagged that there is market proof around teaching people how to “yap” better, including creators selling education around this skill.

Initial creator references to study:

- Jessi Jean Home — https://www.instagram.com/jessijeanhome
- Bonus Footage / Jen — https://www.instagram.com/bonusfootage

Example reels to analyze:

- https://www.instagram.com/reel/DW7DFWIjW34/?igsh=MWE5Y2V6bnRsaHdxaQ==
- https://www.instagram.com/reel/DVPl7nEEVv1/?igsh=MWNsdTRlbTJiMzl1OA==
- https://www.instagram.com/reel/DVC04c4EXCF/?igsh=Yzg5Z3gzMW8wdWI0

Research tasks:

- Analyze how these creators teach yapping/talking-head structure.
- Extract their frameworks, hooks, and repeatable advice.
- Identify what parts can become Yapper scoring criteria.
- Identify what parts can become Lab idea-generation templates.
- Identify what parts can become Gym exercises.
- Avoid copying course IP directly; use public informational videos as inspiration for product principles and user problems.

Important market signal:

- Jen reportedly created a “how to yap” webinar/course-style product and sold about $1.2M of it. This suggests strong demand for making casual talking-head content into a learnable system.

---

## Product principles

1. **Reps over lessons**
   - Users should improve by doing, not reading.

2. **One fix at a time**
   - Long feedback reports create guilt. One correction creates action.

3. **Casual does not mean unstructured**
   - Yapper should help users sound natural, not robotic.

4. **Inspiration should become output**
   - Saved content should feed creation, not become a graveyard.

5. **Feedback should lead to a runback**
   - The most important product behavior is trying again.

6. **Editing supports speaking**
   - Light editing is useful, but the core product is the speaking/content loop.

7. **Yapper should feel slightly opinionated**
   - The coach should be useful, blunt, and specific — not generic or academic.

---

## Open questions

- Should Gym and Lab be equal top-level tabs, or should Lab be the creator-facing wedge and Gym be the training mode underneath?
- What is the MVP input method for inspiration: pasted links, manual library, uploads, or account connection?
- Should Yapper target creators first or broader self-improvement/public-speaking users first?
- How much scripting is too much before it kills the casual “yap” feel?
- What score dimensions best predict a good talking-head video?
- What creator-platform integrations are realistic for first release?
