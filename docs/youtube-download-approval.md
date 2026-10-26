# YouTube own-video import approval

Researched October 27, 2026. Google project: `yapper-502200`, number
`471533681107`. The approved `youtube.upload` and `youtube.readonly` scopes do
not provide a video-file download endpoint or authorize scraping/downloading.
No new scope, consent-screen edit, audit submission or contact message was made.

## Requesting an exception for the ordinary YouTube integration

[Developer Policies III.E.1](https://developers.google.com/youtube/terms/developer-policies#e.-handling-youtube-data-and-content)
requires prior written approval to download/import/cache audiovisual content.
The policy links its approval/contact requests to the
[YouTube Data API Services Audit and Quota Extension Form](https://support.google.com/youtube/contact/yt_api_form?hl=en).
This is a general contact/audit route, not a documented download-permission
workflow with a guaranteed approval or a download API that appears afterward.

The live form was inspected in the signed-in Can Chrome profile. Its request
reasons currently offer only an additional-quota audit or a requested re-audit.
There is no download-only reason. Do not claim that Google requested a re-audit
or invent an additional quota need to submit it. Ask the existing verification
contact to route this narrow request to the YouTube API Services compliance team
and confirm how the form should be filed. OAuth verification and YouTube API
compliance are separate teams/processes; an OAuth approval reply is not download
approval. No message has been sent.

Prepare these details if Google directs us to the audit form:

- Organization/contact details, including the legal address confirmed by the owner.
- Project number above, website `https://ypr.app`, Studio URL
  `https://studio.ypr.app`, privacy policy and terms, OAuth client details.
- Current read/upload use cases and a demo of the proposed own-video import flow,
  clearly marked as proposed rather than already implemented.
- A method for reviewers to access the app, an accurate architecture/data-flow
  diagram, vendors, storage/retention/deletion and ownership checks.
- Actual current quota and usage if requested. Do not invent usage estimates,
  a quota increase, an exemption, or approval of a download method.

## Request text to review and send

Subject: Route an own-channel video import permission request for Yapper, project 471533681107

Hello,

Yapper's OAuth verification was approved for youtube.upload and youtube.readonly
for project yapper-502200 (471533681107). We understand that this does not grant
permission to download or import YouTube audiovisual content.

We would like to request prior written approval under Developer Policies
III.E.1 for a narrow creator-controlled feature: a signed-in creator connects
their own YouTube channel, selects one of their own uploads in Yapper, and
explicitly asks to import it for preparing a post to another account they control.
There would be no general-purpose downloader, third-party-channel import,
audio-only extraction or unattended historical-feed download.

We propose to verify channel ownership through the authorized YouTube account,
require the creator to confirm they hold the necessary content rights, preserve
applicable attribution and metadata, and use temporary owner-scoped storage.
Yapper allows one waiting video; successfully published media becomes eligible
for cleanup 24 hours after all destinations finish, while an active publication
or schedule protects its source. A creator can explicitly discard a waiting
file. These are the existing publishing-storage rules, not a claim that this
proposed YouTube download flow is already approved or implemented.

Please confirm whether this use case can receive written approval, which team
and form should handle it, and which supported technical retrieval method you
would permit. The currently linked audit form offers only quota-increase and
requested-re-audit reasons; neither accurately describes our request. We are not
requesting additional quota at this stage.

We can provide an app walkthrough, data-flow diagram, retention details and
reviewer access. Please also advise whether Google's Data Portability API is the
appropriate route for eligible users instead of a YouTube Data API exception.

Thank you.

## Official alternative: Data Portability API

Google already has an official API for moving a creator's uploaded video media.
The [YouTube export schema](https://developers.google.com/data-portability/schema-reference/youtube)
includes the original format / MP4. Relevant
[scopes](https://developers.google.com/data-portability/user-guide/scopes)
include `dataportability.youtube.public_videos` and
`dataportability.youtube.unlisted_videos` (sensitive), and
`dataportability.youtube.private_videos` (restricted).

This needs its own API setup and OAuth verification. Restricted scopes can
require a security assessment. Do not add these to Yapper's approved consent
screen as part of the TikTok work. Start with public videos only if pursuing
this path; private videos should not be requested without a concrete need.

This is an asynchronous archive/export flow with signed download URLs, and can
take minutes to hours. It is not a single selected-video download call. Its
[account eligibility list](https://support.google.com/accounts/answer/14452558?hl=en)
currently covers listed European countries, Switzerland and the United Kingdom;
Canada and Türkiye are absent. Eligibility also depends on account type/age and
other restrictions, so do not infer it from the user's current browser location.
The [overview](https://developers.google.com/data-portability/user-guide/overview)
explains setup and verification; the
[development guide](https://developers.google.com/data-portability/user-guide/introduction)
explains authorization, archive jobs, polling and signed URLs.

Recommended next step: send the routing/permission request above for the wider
YouTube integration. Evaluate Data Portability separately if its eligible-market
coverage and asynchronous export experience fit the product. Until an approved
retrieval path is established, YouTube keeps Attach original video. The October
26 OAuth approval alone does not establish a download exception.
