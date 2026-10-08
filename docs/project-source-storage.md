# Project sources and publishing storage

An idea created from an editor export stores `yapper://project/<UUID>` as its
source. That UUID identifies the original local timeline, not the cloud MP4.
The native canvas saves pending edits before opening the source. Every editor
handoff first resolves the owned content item, then looks up that project ID in
the current project, local library, or recently opened packages. It does not
request a signed media URL or create a project for an editor source. Missing
originals show a recovery message; existing downloaded copies are left alone.
Ordinary recording handoffs keep their existing authenticated download flow.

Storage totals count active cloud objects, not the contents of the Poster
Uploads tab. Editor exports belong to Made in Yapper; direct Poster uploads
belong to Uploads; cross-post imports come from connected platform posts.
`GET /api/storage/videos` lists the same active recording/import objects as the
breakdown, with an origin, platform, and retention reason. Unpublished editor
exports, scheduled posts, and active publishing cannot be removed through the
manager. Explicit removal of other cloud copies keeps written work.

Successfully published media, including the current editor export, becomes
eligible for cleanup after all attempts finish and the 24-hour retry window
expires. Active schedules and publishing jobs still protect the file. The daily
lifecycle worker removes the cloud video while preserving the local project,
script, transcript, pillar, and posting history. Posting again uploads a fresh
export from the local project. Explicit removal can waive the retry window.
Unpublished imports can remain available for reuse. Expired upload reservations remain counted until
the existing lifecycle worker releases them; Storage labels these as awaiting
cleanup rather than calling them in-progress uploads.

Validation includes original project lookup after renaming and moving outside
the library, rejecting malformed project links and implicit downloads, and
storage inventory/ownership/deletion checks against a migrated PostgreSQL test
database. Native changes require a rebuilt Mac app; the API fields are additive
and old clients continue decoding them.
