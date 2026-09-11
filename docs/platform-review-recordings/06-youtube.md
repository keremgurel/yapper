> Earlier detailed reference. For filming, use the four concise scripts in [the recording index](../platform-review-demo.md).

# Recording 06 — Google OAuth and YouTube publishing

File: `06-youtube-oauth-library-upload.mp4`. About 4–5 minutes plus processing. Covers `youtube.readonly` and `youtube.upload`.

## Before filming

Use the integration connected to Google project `yapper-502200`. Its domain and branding are verified; the YouTube scopes are not yet verified. Use a channel you control with an existing video. Sign into Google off camera, disconnect YouTube in Yapper, and start recording before clicking Connect.

**Current UI limitation:** Poster requests public visibility automatically. There is no YouTube privacy or made-for-kids selector. Do not invent that step. Use a sample you are comfortable making public. YouTube may restrict actual visibility; show the value in Studio. OAuth verification does not establish approval of the separate public-upload compliance audit.

The Google form asks for a YouTube demo link covering every OAuth client assigned to this project. Before submission, inventory those clients and append any other active client's actual authorization flow. Showing the Mac wrapper alone does not prove an unseen client was tested.

## 1. Introduce

**Do:** Show `https://ypr.app` in the address bar and open Yapper. If demonstrating the Mac app, show it opening and transitioning to hosted Poster. Optionally include a brief creation-workflow excerpt.

**Say:**

> “Hi Google review team. I'm Kerem, the founder of Yapper. Yapper is a content studio for creators to develop ideas, record and edit original videos, and publish to their connected channels. This recording demonstrates our Google authorization flow and how we use the YouTube read and upload permissions.”

## 2. Show full Google authorization

**Do:** Open **Connections → YouTube → Connect**. Show Google's account chooser and choose the intended account/channel. If an unverified-app warning appears, leave it visible, then use Google's offered continuation for your own test account. Show Yapper's name, both requested permissions, and the authorization page's address bar. Scroll through consent and authorize. Do not record passwords, two-factor codes, or the callback authorization code.

**Say:**

> “I select Connect for YouTube and choose the Google account associated with my channel. This is Google's real consent flow. Yapper requests permission to read my YouTube account and upload my videos. I review those permissions and authorize the connection.”

**If the warning appears, add:**

> “The YouTube permissions are still awaiting verification, so Google displays this warning for the test connection.”

## 3. Connected channel and library

**Do:** Show YouTube's connected channel name/handle in **Connections**. Open **Poster → YouTube** in the Video source tabs. Show actual uploads, titles, thumbnails, and view counts. Open the same channel in YouTube separately to establish identity.

**Say:**

> “The connected channel is now visible in Yapper. The YouTube source tab reads that channel's uploads and displays their titles, thumbnails, and view counts. This is the read-only permission in use. It lets the creator review their own channel's content inside Poster.”

The current cards show titles, thumbnails, dates, and views. Do not claim every field returned by the API is visible. Verify visibility in Studio below.

## 4. Creator-feed reading

**Do:** Open Yapper's **Inspiration** area and an existing YouTube creator feed selected by you. Show actual titles/thumbnails and available statistics. Your own public channel can be the example. Rehearse the exact creator-feed navigation before filming.

**Say:**

> “Yapper also reads public video metadata for a creator feed selected by the user. This screen shows that feed's videos and their available statistics.”

This use appears in the prepared scope explanation. If it cannot be demonstrated, resolve it or revise the submission's description before sending the recording.

## 5. Original video and copy

**Do:** Return to **Poster → Made in Yapper**. Select and play the camera-check clip, then choose only YouTube. Set its title to `Three checks before recording` and review the prepared description. If Poster requires a cover, choose a frame from the video. Click **Publish to 1 destination** and show the intended channel in the final sheet.

**Say:**

> “I choose an original video I recorded, review the preview, and edit the title and description. I select only my connected YouTube channel. This version of Poster requests public visibility, as shown in the posting notice.”

## 6. Upload and actual visibility

**Do:** Click **Publish 1 video to 1 platform**. Show the upload result. Open **YouTube Studio → Content**, locate the exact new video, and show its title, description, playback, and **Visibility** value. Wait for processing; label any time cut.

**Say before sending:**

> “I click Publish to authorize this upload. The upload permission lets Yapper send this video and its metadata to my connected YouTube channel.”

**Say after the video appears:**

> “Here is the uploaded video in YouTube Studio. Its title and description match what I reviewed in Yapper. YouTube Studio shows its actual visibility here.”

If its visibility is Private, add:

> “YouTube has kept this upload private. I am showing that actual result; public upload approval is a separate requirement.”

## 7. Disconnect and close

**Do:** Open **Connections → YouTube → Disconnect**, show **Connect**, then open Yapper's privacy and data-deletion/contact instructions.

**Say:**

> “The creator can disconnect YouTube in Connections. Our privacy policy explains data handling and deletion requests. This completes the demonstration of our Google authorization flow, YouTube read access, and user-authorized upload.”

## Finish and delivery

Keep the account chooser, any warning, complete permission consent, return to Yapper, channel identity, working read features, upload action, and matching Studio result. Upload this review recording itself to YouTube as **Unlisted**, test its link signed out, and put that link in the Google Data Access demo field. This review recording's visibility is separate from the sample uploaded through Yapper.

[Google verification submission guidance](https://support.google.com/cloud/answer/13461325?hl=en)
