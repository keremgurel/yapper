# Video scripting research

Research behind the version writers in `src/lib/ideas/versions/`, gathered 2026-09-24. The sources that hold up are YouTube's own documentation, the leaked MrBeast production memo, Derek Muller's PhD research, and first-hand creator interviews. Most "retention hack" articles repeat each other without a source and were left out.

## Long-form

Creators split on how much to script, and on-camera skill decides it. George Blackman, who writes for large channels, recommends detailed bullets with the setup, transitions and payoff written word for word, because transitions are where viewers leave. Ali Abdaal talks from a few bullets; Ed Lawrence (Film Booth) and Johnny Harris write full scripts. Yapper writes word for word by default because most founders and educators are not practised at riffing. A later option can reduce a script to its must-say lines.

The first 30 seconds decide retention: YouTube Studio's intro metric is the share still watching at 0:30, and YouTube's guidance is to deliver on the title and thumbnail immediately. Rene Ritchie (YouTube's creator liaison): "The first act can't just be an introduction. The first act has to be a reward." The MrBeast memo: the first minute must match the "clickbait expectations" or viewers feel lied to.

In the body, each chapter opens with a question or claim and closes on a "but" or "therefore" line (Parker and Stone's rule against "and then"). Put the second strongest point early. For educational videos, stating and refuting a common misconception is the one structure with experimental support: Muller's randomized study found it significantly improved learning (d = 0.71) over a clear explanation alone.

End on the payoff, call back to the opening, point to one next video, and stop. No summary, no "that's it for today".

The writer's template, for about 10 minutes at 150 spoken words a minute:

| Part                          | Time               | Words                         |
| ----------------------------- | ------------------ | ----------------------------- |
| Chapter 1, the hook           | 0:00 to about 1:00 | 120 to 160                    |
| Body chapters                 | 1:00 to about 9:00 | 3 to 6 chapters of 200 to 450 |
| Final chapter, the payoff     | last 60 to 90 s    | 150 to 220                    |
| One pointer to the next video | last 10 to 20 s    | 25 to 50                      |

### Chapter lines

A chapter is a line starting with `## ` and a 2 to 6 word title stating the chapter's claim. No timestamps, because they go stale on the first retake; real ones come from the recording. YouTube drops the whole chapter list unless the first chapter is at 0:00, there are at least three, and each is at least 10 seconds, so the script always opens on a chapter and the editor should warn under three. Non-spoken notes go on their own line as `[B-ROLL: ...]` or `[ON SCREEN: ...]` and are never counted as spoken words.

Runtime is spoken words divided by 150, shown as a range (130 to 170 words a minute covers most talking-head delivery) until the creator's own pace is known.

## Short-form

Paddy Galloway's study of 3.3 billion Shorts views found most run 20 to 40 seconds; Jenny Hoyos (about 10 million views a Short) aims for about 34 seconds. Yapper's default is 80 to 130 words after the hook (35 to 55 seconds), up to 200 for a story or multi-step explainer. The first line after the hook says where the video is going, beats connect with "but" or "therefore", there is one specific takeaway worth sending to a friend (Instagram weighs sends heavily for reaching non-followers), and the video ends on the payoff with no outro.

## Articles

People scan and read a fraction of a page (Nielsen Norman Group's eye-tracking work), so the answer comes early and each section's first sentence carries its point. Lenny Rachitsky starts from one concrete question and cuts hard; Justin Welsh keeps one idea per piece. The template: a specific headline, a one-line subhead saying who it is for, 2 to 4 opening paragraphs that give the answer, 3 to 5 sections headed by claims, then what video can't carry (numbers, quotes, steps, caveats), and a short close with one next action.

## Between formats

Long to article: chapters become sections, and everything that exists only to hold a viewer (re-hooks, teasers, recaps) goes. Article to long: sections become chapters, lists shrink to the best 3 to 5 items each with a story, and a cold open is added. Long to short: take one chapter's claim and best example, rewrite the first line as a hook, drop references to other parts. Short to long: the short is the thesis, expanded with the stakes, the misconception, 3 to 5 beats with examples, a counterargument and practical steps.

## Where evidence is weak

Whether chapters help or hurt retention is unproven either way; YouTube publishes nothing. No dataset supports re-hooking on a fixed timer, so the writer re-hooks at each chapter instead. Word for word versus outline is a preference split with no retention data. Speaking pace varies from about 130 to 200 words a minute between people.

## Sources

1. MrBeast production memo: https://www.alexanderjarvis.com/memo-how-to-succeed-in-mrbeast-production/
2. YouTube Help, video chapters: https://support.google.com/youtube/answer/9884579
3. YouTube Help, key moments for audience retention: https://support.google.com/youtube/answer/9314415
4. George Blackman, the 3 levels of YouTube scriptwriting: https://www.georgeblackman.com/write-on-time/the-3-levels-of-youtube-scriptwriting
5. Ed Lawrence on Creator Science: https://podcast.creatorscience.com/ed-lawrence/
6. Jenny Hoyos on Creator Science: https://podcast.creatorscience.com/jenny-hoyos/
7. Derek Muller, PhD thesis on misconceptions in video: https://www.academia.edu/18111353/PhD_Muller_Designing_effective_multimedia_for_physics_education
8. Parker and Stone, NYU writing talk: https://speakola.com/arts/matt-stone-trey-parker-nyu-writing-class-2014
9. Rene Ritchie on hooks and satisfaction: https://www.searchenginejournal.com/youtube-algorithm-insights-from-creator-liaison-renee-ritchie/493901/
10. YouTube Creator Playbook, the first 15 seconds: https://blog.youtube/creator-and-artist-stories/youtube-creator-playbook-tips-first-15/
