# The Yapper loop

Status: direction agreed 2026-09-07. This replaces the Idea bank / Content
Library split and reshapes Brain. Phases at the bottom; each lands on its own.

## The loop

Capture an idea, develop it into a script, shoot it, edit it, post it. Every
surface exists to move an idea one step along that line, and nothing else.

Two kinds of work happen on the way:

- Automatic. The moment an idea is captured, Yapper does the first pass
  without being asked: transcribes the inspiration if there is a link,
  classifies the pillar, and writes a content direction (a short direction, a
  few hook options, a full first-draft script in the creator's voice). That is
  the whole automatic set. No key points, no research, no fixed sections.
- Open canvas. From then on the idea's page is a conversation. The creator
  talks to Chirpy the way they would talk to a chat model ("tighten the middle",
  "what are the key points here", "give me three colder opens"), edits any
  block by hand, and useful answers land on the page as blocks. Nothing on the
  page is a slot to fill.

## One surface: Ideas

There is one list. An idea has a status: Captured, Drafting, Ready, Posted.
A date on a Ready item means it is scheduled; the publishing queue reads the
date. The board grouped by status is the pipeline. The capture box sits on top
of the list.

Why not two places: the difference between a raw idea and one the creator has
committed to is a status, not a room. Two rooms cost a "send to library" step,
two sets of views, and a page that opens empty for a new creator.

## What Chirpy knows, by task

Everything Chirpy writes reads the Brain, but not all of it every time. The
router already chooses what loads per task; this fixes what each task may see.

| Task                    | Always                                                    | Chosen per task                                                                                                                                       | Never                 |
| ----------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Capture, classify       | pillars                                                   |                                                                                                                                                       | anything else         |
| Develop, script, canvas | voice profile, scripting patterns, pillar description     | matching knowledge notes and saved inspirations, applicable skills, one or two of the creator's own past scripts as examples, the idea's own material | past captions         |
| Caption                 | caption voice (previous captions), platform rules, pillar | the finished video's transcript, the hook, the script                                                                                                 | scripting patterns    |
| Overlays                | transcript, brand kit                                     |                                                                                                                                                       | the rest of the brain |

## Brain

Three layers, in the order a new creator meets them.

Voice, from the creator's own videos. Pick videos from connected channels; each
is transcribed (one credit per three minutes, rounded up, shown before
confirming); the selection is always editable. From the transcripts Yapper
derives a voice profile (tone, pacing, phrases, how they open and close, what
they never say) and scripting patterns (how their scripts are built). Both are
editable text, regenerated when the selection changes, and both sit in the
core context for scripting. Essentials (what you make, who it is for, pillars)
are drafted from the same transcripts and channel data and edited inline on
the page. No sheet form as the entry point.

Knowledge stays what it is: notes, lists, tables, documents, and saved
inspirations. Research and beliefs, routed per task.

Skills stay what they are.

Caption memory is collected, not curated: the last few dozen captions from the
connected channels plus everything posted through Yapper, read only when
writing a caption.

Two things close the loop: the transcript of the video actually shot and
edited flows back onto its idea, so captions come from what was said; and
"learn from what I post" offers each newly published video into the voice set.

## Phases

1. One Ideas surface. Statuses Captured, Drafting, Ready, Posted with a
   migration from drafted, planned, scheduled and the bank stage. Capture
   produces the content direction. Navigation, native destinations, calendar
   and home follow.
2. Canvas conversation. A persisted thread per idea; replies can carry canvas
   actions; answers can be added to the page.
3. Brain voice. Video picker from connected channels, per-video transcription
   with credit math, derived voice profile and scripting patterns, inline
   essentials, and the per-task context table above.
4. Caption memory and the closing of the loop: recorded transcript back onto
   the idea, learn from what I post.
