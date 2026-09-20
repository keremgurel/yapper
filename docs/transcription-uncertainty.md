# Preserve unresolved speech during automatic editing

Implementation review: 2026-09-20.

An acoustic classifier can detect speech that automatic speech recognition
(ASR) does not transcribe. A reported `transcription_incomplete` response
contained a half-second unmatched interval at 525.625–526.125 source seconds.
Rejecting an otherwise usable transcript blocks editing; treating that interval
as silence can delete speech. The editor now retains the uncertain audio and
only captions recognized words.

## Server behavior

The server tries short Nova-2 and Nova-3 recovery excerpts, followed by Whisper
when configured. Different models may reuse an excerpt when there is no unused
overlap. Each recovery request has a bounded timeout within the route's shared
deadline.

Updated native clients explicitly send `preserveUnresolvedSpeech: true`.
The response includes `unresolvedSpeech` in original source timestamps.
`coverageChecked: true` acknowledges the coverage check; it does not assert
that every detected interval was recognized. Legacy clients still receive an
error and refund when recovery cannot close a gap.

Recovery failures are handled per excerpt, preserving successful parallel
recoveries. Optional provider failures leave their intervals unresolved.
Cancellation and truncated audio remain failures with refunds, including when
another concurrent excerpt times out. A completely empty transcript with
detected speech is still refused and refunded. The change does not alter
credit prices or authorize additional customer charges for recovery passes.

## Native behavior

The app validates returned ranges and saves uncertainty alongside the
transcript. One-click retake removal, filler removal, and Auto-trim reject cuts
crossing those intervals, including a 0.25-second margin and overlapping words.
A crossing retake cut is rejected whole to avoid leaving an isolated fragment
of the unknown take. Unrelated cuts still proceed.

The completion status reports unclear audio sections kept. Captions contain
recognized words only. Existing projects load without uncertainty metadata, and
successful revision-4 transcripts remain reusable. Failed cleanup retains the
new transcript and its uncertainty metadata together when recovering a
previously untranscribed project.

## Validation

Server regressions cover short-context recovery, legacy refusal, the reported
half-second interval, optional timeouts, mixed successful/failed excerpts,
cancellation, truncated excerpts, empty transcripts, refunds, and upload
cleanup. Native regressions cover project persistence and backward-compatible
decoding, retake protection, quiet-speech protection during silence trimming,
and retention of a transcript after failed cleanup.

Live transcription of the originally reported recording is not part of this
merge verification. Automated checks use mocked providers and generated audio;
no user recording is uploaded by those checks. Historical local deployment
notes and temporary comparison files are not a release manifest. Verify the
installed app's build revision and current deployment before diagnosing a
version mismatch.
