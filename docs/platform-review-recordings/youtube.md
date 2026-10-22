# YouTube — one complete recording

Aim for about 3–5 minutes plus necessary processing. Use the one-sentence introduction in Setup; no native-editor walkthrough is needed. Use a channel you control with existing videos and the integration for project yapper-502200. Branding is verified; scope verification is pending.

Before filming, verify the deployed composer shows Private, Unlisted, and Public visibility choices, a made-for-kids selector, and the altered/synthetic-media disclosure. Choose the truthful audience and disclosure for your sample; use Unlisted visibility for a low-impact upload test. These controls must be present in production before using this script.

## 0. Show website sign-in

The project's Clients page was checked on October 23. It has **two** OAuth clients, and the submission asks for all clients:

- **Yapper Website Login** — `471533681107-qhpoldjkd68sk7ohf6fmif9cn0nlkvlj.apps.googleusercontent.com`
- **Yapper website YT publish** — `471533681107-4lk9m7to18qu4tt0ug0i4dsqvcdb3531.apps.googleusercontent.com`

**Do:** In a separate signed-out Yapper tab, click Continue with Google. Show Google's account/consent screens and the successful return to Studio. Keep the client ID on the authorization page identifiable where available; do not show any client secret. Show all requested permissions in English. Pause for private credentials only.

> “First I sign in to Yapper with Google. This identifies my Yapper account. Connecting my YouTube channel is a separate step.”

## 1. Connect through Google

**Do:** Connections → YouTube → Connect. Show Google's account chooser, any unverified-app warning, and the complete permission consent. Choose your intended account/channel, authorize, and return to Yapper. Keep authorization-page identity readable; keep passwords and callback authorization codes out of the recording.

> “I connect my YouTube channel through Google. I review the permissions to read my YouTube account and upload videos, then authorize Yapper.”

If a warning appears, add:

> “The YouTube permissions are awaiting verification, so this test connection displays Google's warning.”

## 2. Show read access

**Do:** Show the connected channel in Connections, then Poster → YouTube source tab. Show existing videos and their titles, thumbnails, and view counts. Open [Inspiration](https://studio.ypr.app/studio/inspiration) directly (it is not in the current sidebar), choose Creators and open a YouTube creator you saved. Prepare or refresh that feed during rehearsal so real titles, thumbnails and metrics are visible. This use is included in the prepared scope explanation.

> “Yapper shows my connected channel and its video library. It also reads public video information for creator feeds I choose to follow.”

## 3. Review the upload

**Do:** Poster → Uploads → Add video → choose and preview your original MP4 (or select its already-saved Uploads entry) → choose only YouTube. Edit the title and description. Choose a video frame for the cover if required. Click Publish to 1 destination, and show the destination channel. Open the visibility selector to show all three choices, choose Unlisted, and answer the audience and altered/synthetic-media questions truthfully.

> “I choose my original video, edit its title and description, and confirm the connected channel. I choose Unlisted visibility and specify the audience and any realistic altered or synthetic content.”

## 4. Publish and verify in Studio

**Do:** Click Publish 1 video to 1 platform. Show the upload result, then YouTube Studio → Content → the actual new video. Show its title, description, playback, and Visibility. Label any processing time cut.

> “I authorize the upload. Here is that video in YouTube Studio, with the same title and description. This is the actual visibility assigned by YouTube.”

Only narrate the result once the video appears. Read the visible value; do not call it public if Studio says Private. OAuth scope verification is the current Google submission. Do not claim an automatic private-only upload restriction: the current videos.insert documentation explicitly says unverified API projects are not restricted to private viewing. A compliance audit can still be requested by YouTube and is used for quota extensions. [YouTube upload reference](https://developers.google.com/youtube/v3/docs/videos/insert)

## 5. Close

**Do:** Connections → YouTube → Disconnect; show Connect again. Briefly show the deletion/contact instructions at https://ypr.app/privacy.

> “Disconnect revokes Yapper’s Google access. My videos remain on YouTube. Because Google sign-in shares this project, Google may ask me to authorize it again next time. Our privacy policy explains data handling and deletion requests.”

Use this narration only after the revocation fix has deployed and passed the rehearsal. The server-side cleanup is now deployed. Legacy browser metadata clears when that browser next opens the library; do not claim instant remote erasure of offline devices. Original source files and user-authored notes remain.

Upload this review recording itself as an Unlisted YouTube video and test its link signed out. Use that link in Google's Data Access form. The current form requires coverage of all OAuth clients in the project: the website sign-in and YouTube connection flows above cover the two clients currently listed. Recheck Clients if another is added. [Google verification guidance](https://support.google.com/cloud/answer/13461325?hl=en)
