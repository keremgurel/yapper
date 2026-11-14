# Poster composer

Poster uses the same two steps on web and Mac. Source shows equal tiles, a muted connection state, and the selected library below. Native retains **Made in Yapper** for local edits. The Post step uses a shared label column and consistent field and action edges. The video and its cover sit in one row. Destinations are always selected explicitly.

One gear opens settings for the selected platforms. The composer shows visibility and links directly to missing required settings. Captions inherit the shared text until a platform override is written. The generation action can fill both the shared caption and the YouTube title, and its changes can be undone.

**Edit cover** stages the exact decoded frame, optional artwork, and editable text until Apply. Cancel leaves the previous cover intact. The preview, PNG download, and JPEG upload use the same drawing. The Mac editor reuses the Studio text appearance model and inspector controls. TikTok Direct Post receives the selected frame timestamp; it does not receive separate cover artwork. YouTube applies custom art after video processing when possible.

## Post-deploy checks

Web account: `the.ypr.app+qa@gmail.com` (real verification code; Kerem signs in). Use a short test clip and the designated QA accounts.

1. Open [Poster](https://ypr.app/studio/poster). Check that the sources have matching edges. Select a connected channel and open a video. Confirm its caption is present and no destination starts selected. Also try a disconnected tile and check that its connect action is visible.
2. Pick YouTube. Confirm the title appears and the single gear opens visibility and the caption override. Choose **Unlisted**, close the panel, and confirm the summary reflects the choice.
3. Open **Edit cover** and advance one frame. Add text, choose Editorial, enable a background and shadow, and apply. Reopen to verify the styling is preserved. Download the cover and check it against the preview. Repeat this on the Mac build and at phone width on the web.
4. If a connected test account is available, send a private or unlisted test post and check the destination result. For TikTok Direct Post, confirm the audience starts empty. For YouTube Shorts, allow processing time before checking the applied cover. Check that **Schedule instead** still opens the date and time.
