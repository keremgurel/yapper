# Poster video retention

Poster is temporary publishing storage. Each account may have one waiting video,
plus files needed by scheduled posts, active publishing, or bounded processing.
Scripts, transcripts, ideas, and feedback survive video cleanup. Brand logos are
outside this policy.

The upload/import preflight is a convenience check. The authoritative check runs
inside `activateObjectWithinTx`, under the per-user storage lock shared with
registration and scheduling. Two uploads can receive URLs concurrently, but only
one can become a new waiting video. The loser returns `poster_slot_busy`; pending
uploads remain subject to the existing upload-expiry worker. Same-file retries
and shared submission/import references do not consume another slot.

Daily maintenance repairs legacy excess uploads/imports by retaining the newest
waiting physical object per account and releasing older ones. Published and
scheduled files do not displace the waiting video. Discovery deduplicates object
keys and release rechecks eligibility inside the transaction. An active publish,
active schedule (including needs-attention), recent publishing attempt, recent
submission, or unexpired processing lease protects the file. Transcription leases
cover the route's full time budget. Active publishing must reach a terminal state
before automatic release; age alone is not evidence that it is safe to delete.

Published media is eligible 24 hours after all destinations finish, provided at
least one succeeded and no schedule still needs it. Removing a durable reference
refunds each physical object's quota once, clears only media links, and enqueues
physical deletion through the existing leased worker. That worker retries failed
deletions. The storage counter changing is not proof of physical deletion.

## Account repair

Run the repair script with configured database and R2 credentials. It previews by
default and requires an exact account ID; it does not infer which user to modify.

```sh
node --env-file=.env.local --import tsx scripts/cleanup-poster-media.ts --user-id USER
node --env-file=.env.local --import tsx scripts/cleanup-poster-media.ts --user-id USER --apply
```

Apply rechecks candidates, releases eligible excess videos, drains only that
account's deletion queue, and verifies the released files are absent with R2 HEAD
requests. It reports retained bytes and any incomplete deletions. The latest
waiting video stays even if it is old; posting, scheduling, or explicitly
discarding it frees the slot.
