# Published ideas as selective memory

Editor exports and uploaded recordings keep their actual speech in `recordedTranscript`. The script canvas receives that text verbatim when it is empty, or when it still contains an untouched copy of the previous export. Existing drafts, script blocks, notes and manual pillar choices are preserved. Explicitly clearing a script or pillar disables automatic filling of that field.

A bounded background classifier chooses only from the owner's existing pillars, including their descriptions and examples. It can return no match; it never invents a category. It runs on editor attachment, transcript arrival and successful publication. A durable five-minute retry lease prevents concurrent requests from duplicating provider work, and successful classifications (including no match) remember their input fingerprint. Speech is saved independently of provider success. Classification uses the existing router allowance and global provider budget, without a separate customer credit charge.

Older posted entries are repaired three at a time after authenticated Ideas/Library reads. Opening an individual entry immediately fills its missing script from existing speech and schedules classification. The recovery uses only the creator's recorded transcript, an owned submission, or an explicitly marked legacy Poster upload; inspiration transcripts are never treated as the creator's voice. Missing speech is left missing rather than invented. No historical audio is retranscribed. These read-triggered repairs require a refresh to display a newly assigned pillar.

A new edit of a project that was posted, or has a scheduled or in-flight publication, gets a new current-master entry. The earlier entry retains its transcript, script, category and publish-job links. Poster continues to show only the current master. Archived media remains subject to normal cleanup; its text survives cleanup.

## Chirpy retrieval

Published scripts are separate from the standing Brain snapshot and its always-loaded voice sample. They are not indexed into the default prompt. Callers opt in with `memoryTask`, containing the current creator request rather than a source transcript or assistant response. Caption generation, preview and editor action planning do not opt in.

The selector reads only that request and the small pillar catalogue:

- A new Ship log idea/script selects the latest three posted scripts in Ship log (two when requested).
- A named post selects that exact title, without falling back to unrelated examples if absent.
- A question about previously covered topics performs a bounded full-text search.
- Unrelated requests and requests not to use history select nothing.

The database filters by owner, project, posted status and the selected pillar/title/topic before returning script text. Recency uses successful publication times, falling back to creation time for manually marked posts, never the latest autosave. Recorded speech takes precedence over a written draft. Responses contain at most three excerpts of 4,000 characters each and identify truncation. Full scripts stay stored in the idea bank. Retrieved text is labelled as untrusted reference material, and actual reference titles are added to the existing `used.context` disclosure; conversational replies are instructed to name the references briefly.

Routing decisions are cached for ten minutes with account, project, request and pillar definitions in the key. Script contents are queried fresh every time. Router timeouts use a conservative named-pillar fallback; no broad library loading occurs on failure. Database failures retain the ordinary Brain context and tell the writer that published references were unavailable.

## Verification

PGlite tests cover transcript recovery, user isolation, manual edits and clears, concurrent changes, provider failure/retry, no-match deduplication, posted versus draft state, exact title/topic retrieval, context limits, publication ordering and preservation of published revisions. Route tests verify authenticated enrichment scheduling. The provider egress inventory includes both new bounded calls.

The optional synthetic provider evaluation runs with `RUN_MEMORY_PROVIDER_TESTS=1` and `SURPLUS_API_KEY` configured:

```sh
npx vitest run src/lib/brain/context/published-memory.provider.test.ts
```

Migration `0038_recording_memory` adds only server-owned enrichment fields. Production applies it through the existing deployment migration step.
