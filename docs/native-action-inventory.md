# Native editor action inventory

Status: audit of the native macOS editor as of 2026-09-22, for step 3 of [chirpy-shared-actions.md](chirpy-shared-actions.md). Rows marked registered have shipped; everything else is still to do.

The numbers come from `scripts/app-actions/inventory.py`, which lists every `EditorSession` method the SwiftUI views and the app menu call and traces each one to the seam where it commits. Rerun it after registering actions to refresh the table and, later, to produce the allowlist for the view-boundary lint.

| Measure                                              | Count |
| ---------------------------------------------------- | ----- |
| Session methods called from views and menus          | 204   |
| Methods that change the project, account, or history | 118   |
| Of those, already routed through the action registry | 30    |
| Registered workflows the UI still calls directly     | 5     |
| Methods that are selection, playback, preview, reads | 86    |

The registered methods are the clip speed, lock, crop, overlay keyframe, extract audio, and sound placement paths from steps 1 and 2, plus the property sets (caption and text style, static framing, retouch, background, backdrop, volume) added on 2026-09-22. The 5 workflows (transcribe, one-click cleanup, silence trimming, caption generation, caption toggle) are registered for Chirpy, but the buttons call the session method rather than the registry. That is harmless today because the registry wraps the same method, but it means the UI skips the registry's availability check, and it should be tidied when the caption actions below land.

## Mutations still outside the registry

Proposed IDs follow the existing `editor.<feature>.<verb>` convention. "Property" means the action should be a registered property descriptor (type, range, getter, setter, applicability) rather than a bespoke operation, so a slider and Chirpy share one validator. Session methods are listed so the executor can be found; each one already owns validation, persistence, and Undo.

### Timeline and clips

| Session method                                                          | Commits via        | Proposed action                  | Notes                                                          |
| ----------------------------------------------------------------------- | ------------------ | -------------------------------- | -------------------------------------------------------------- |
| `trimTimelineSelection`, `commitClipTrim`                               | commitTimelineEdit | `editor.clips.trim`              | Explicit clip IDs plus new in/out. Drag preview stays UI-only. |
| `splitAtPlayhead`                                                       | commitTimelineEdit | `editor.clips.split`             | Takes a timeline anchor, not only the playhead.                |
| `deleteTimelineSelection`, `deleteSelected`                             | commitTimelineEdit | `editor.timeline.delete`         | Mixed item kinds: clips, captions, overlays, text, audio.      |
| `commitTimelineSelectionMove`                                           | commitTimelineEdit | `editor.clips.reorder`           | Insertion index; the reorder plan helper is reusable.          |
| `deleteTranscriptWords`, `restoreTranscriptWords`                       | commitTimelineEdit | `editor.transcript.setWordsKept` | One action with a `kept` flag covers both.                     |
| `deleteTranscriptPause`, `restoreTranscriptPause`                       | commitTimelineEdit | `editor.transcript.setPauseKept` | Same shape as words.                                           |
| `promoteClipToOverlay`                                                  | commitTimelineEdit | `editor.clips.promoteToOverlay`  |                                                                |
| `demoteOverlayToClip`                                                   | commitTimelineEdit | `editor.overlays.demoteToClip`   |                                                                |
| `appendMediaToTimeline`, `appendSelectedMediaToTimeline`, `importAudio` | commitTimelineEdit | `editor.timeline.appendMedia`    | Media already in the bin; import itself is below.              |
| `setAspectRatio`                                                        | commitTimelineEdit | `editor.project.setAspectRatio`  | Property.                                                      |

### Captions

| Session method                                      | Commits via             | Proposed action                       | Notes                                                                                                             |
| --------------------------------------------------- | ----------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `addCaption`, `addCaptionAtPlayhead`                | commitTimelineEdit      | `editor.captions.add`                 | Timeline anchor plus optional text.                                                                               |
| `removeCaption`, `clearAllCaptions`                 | commitTimelineEdit      | `editor.captions.remove`              | Explicit IDs; "all" is the caller resolving IDs, not a flag.                                                      |
| `splitCaption`                                      | commitTimelineEdit      | `editor.captions.split`               |                                                                                                                   |
| `mergeSelectedCaptions`, `mergeCaptionIntoPrevious` | commitTimelineEdit      | `editor.captions.merge`               | Ordered ID list.                                                                                                  |
| `setCaptionText`                                    | updateProject           | `editor.captions.setText`             | Also triggers the dictionary suggestion; keep that in the executor.                                               |
| `retimeCaption`                                     | updateProject           | `editor.captions.retime`              |                                                                                                                   |
| `setCaptionStyle`, `applyCaptionTemplate`           | performAppAction        | registered `editor.captions.setStyle` | Pickers, fields, and templates go through the action. Slider drags (live) still use the coalesced preview commit. |
| `moveCaption`, `resizeCaption`, `rotateCaption`     | applyCaptionStyle       | UI-only live drag                     | The canvas drag streams; its final value is not yet routed through the action.                                    |
| `toggleCaptions`, `generateCaptions`                | runTrackedLongOperation | already `editor.captions.setVisible`  | Route the buttons through the registry.                                                                           |

### Text layers

| Session method                                  | Commits via          | Proposed action                   | Notes                                                     |
| ----------------------------------------------- | -------------------- | --------------------------------- | --------------------------------------------------------- |
| `addTextLayer`                                  | scheduleVisualCommit | `editor.text.add`                 | Hook placement is a preset of the same action.            |
| `setTextLayerText`, `updateTextLayer`           | scheduleVisualCommit | `editor.text.update`              | Text, timing, and position in one patch.                  |
| `applyTextLayerStyle`, `applyTextLayerTemplate` | performAppAction     | registered `editor.text.setStyle` | Live slider drags still use the coalesced preview commit. |
| `deleteSelectedTextLayer`                       | scheduleVisualCommit | `editor.text.remove`              | Explicit ID.                                              |

### Video framing

`editor.video.animateFraming` is already registered for keyed animation. The static framing controls below still commit directly.

| Session method                                                                                                   | Commits via        | Proposed action                      | Notes                                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `setFramingScale`, `setFramingOffset`, `setFramingRotation`, `turnFraming`, `resetFraming`, `fillFrameWithVideo` | performAppAction   | registered `editor.video.setFraming` | Unkeyed clips. Keyed clips still write a key through `commitFraming`; canvas drags stay live. |
| `toggleFramingKey`, `moveFramingKey`, `removeFramingKey`, `clearFramingKeys`                                     | replaceFramingClip | `editor.video.framingKey`            | Same operation enum as `editor.overlays.keyframe`.                                            |
| `applyFramingToAllClips`                                                                                         | performAppAction   | registered `editor.video.setFraming` | The button resolves all unkeyed, unlocked clip IDs.                                           |

### Overlays and tracks

Crop, keyframes, zoom, and masks are registered. Placement and visibility are not.

| Session method                                                                   | Commits via        | Proposed action                                         | Notes                                                   |
| -------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------- | ------------------------------------------------------- |
| `addOverlay`                                                                     | commitTimelineEdit | `editor.overlays.add`                                   | Media ID plus timeline anchor.                          |
| `deleteOverlay`                                                                  | commitTimelineEdit | covered by `editor.timeline.delete`                     |                                                         |
| `commitOverlayEdit`, `scaleOverlay`, `fillFrameWithOverlay`, `resetOverlayFrame` | commitOverlayEdit  | `editor.overlays.setFrame`                              | Box in frame fractions; writes a key on keyed overlays. |
| `setOverlayHidden`, `setOverlayBehindSpeaker`                                    | updateProject      | `editor.overlays.setVisibility`                         | Property.                                               |
| `applyOverlayFrame`                                                              | updateProject      | `editor.overlays.applyFrameToAll`                       |                                                         |
| `removeOverlayTrack`, `toggleOverlayTrackHidden`                                 | commitTimelineEdit | `editor.tracks.remove`, `editor.tracks.setHidden`       |                                                         |
| `clearVideoTrack`, `toggleVideoTrackHidden`, `toggleVideoTrackMuted`             | commitTimelineEdit | `editor.video.clearTrack`, `editor.video.setTrackState` | Hidden and muted as one property set.                   |
| `setVisualFilter`                                                                | updateProject      | `editor.video.setFilter`                                | Property.                                               |

### Retouch and background

| Session method                                      | Commits via      | Proposed action                         | Notes                                                                                                                   |
| --------------------------------------------------- | ---------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `setClearBlemishes`, `setWhitenTeeth`               | setRetouch       | UI-only live slider                     | `editor.retouch.set` is registered; the slider has no commit event yet, so it still streams through the coalesced path. |
| `applyRetouchToAllClips`                            | performAppAction | registered `editor.retouch.set`         |                                                                                                                         |
| `setBackgroundRemoved`, `applyBackgroundToAllClips` | performAppAction | registered `editor.background.set`      |                                                                                                                         |
| `setBackdrop`                                       | performAppAction | registered `editor.project.setBackdrop` | Colour well commits through the action; live scrubbing stays coalesced.                                                 |

### Audio

`editor.audio.addAt` and `editor.clips.extractAudio` are registered.

| Session method                                | Commits via                | Proposed action                                     | Notes                                  |
| --------------------------------------------- | -------------------------- | --------------------------------------------------- | -------------------------------------- |
| `commitAudioTrim`                             | commitTimelineEdit         | `editor.audio.trim`                                 |                                        |
| `deleteSelectedAudioLayer`                    | commitTimelineEdit         | covered by `editor.timeline.delete`                 |                                        |
| `commitLayerVolume`, `commitVideoTrackVolume` | performAppAction           | registered `editor.audio.setVolume`                 | Fader release goes through the action. |
| `replaceSound`                                | commitTimelineEdit         | `editor.audio.replace`                              |                                        |
| `addSavedAudio`, `removeSavedAudio`           | commitPreparedTimelineEdit | `editor.audio.addSaved`, `editor.audio.removeSaved` | Saved recordings from Studio.          |

### Media bin and project

| Session method                                                             | Commits via             | Proposed action                              | Notes                                                                                                     |
| -------------------------------------------------------------------------- | ----------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `importMedia`, `importDropped`, `openStudioRecording`                      | persist                 | `editor.media.import`                        | Needs a file reference the model cannot supply; Chirpy can only offer to open the picker. Effect: import. |
| `deleteImportedMedia`, `deleteSelectedMedia`                               | commitTimelineEdit      | `editor.media.remove`                        | Also removes timeline instances; the receipt should list them.                                            |
| `resetMediaToSource`                                                       | commitTimelineEdit      | `editor.media.resetToSource`                 |                                                                                                           |
| `pasteProperties`                                                          | updateProject           | none                                         | Clipboard is UI state. Chirpy reaches the same result through the style property sets.                    |
| `renameCurrentProject`                                                     | persist                 | `editor.project.rename`                      |                                                                                                           |
| `createProject`, `duplicateProject`, `duplicateCurrentProject`, `saveCopy` | persist                 | `projects.create`, `projects.duplicate`      | Workspace scope, not project scope. Effect: navigation.                                                   |
| `openProject`                                                              | persist                 | `projects.open`                              | Effect: navigation. Invalidates Chirpy's project context.                                                 |
| `trashProject`                                                             | persist                 | `projects.trash`                             | Effect: destructive. The card button has no confirmation today; add one that both paths share.            |
| `export`, `exportForPosting`                                               | runTrackedLongOperation | `editor.export`                              | Workflow. Effect: export. Output path comes from a save panel.                                            |
| `undo`, `redo`                                                             | restoreHistorySnapshot  | `editor.history.undo`, `editor.history.redo` | Chirpy should be able to undo its own batch.                                                              |

### Account dictionary

| Session method                                                                                                            | Commits via            | Proposed action                                                                            |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| `addDictionaryTerm`, `addDictionaryAlias`, `removeDictionaryAlias`, `removeDictionaryEntry`, `acceptDictionarySuggestion` | DictionaryStore.shared | `account.dictionary.addTerm`, `account.dictionary.setAliases`, `account.dictionary.remove` |

These are account scoped, outside project revision and Undo. The protocol's request shape currently requires a project ID and revision, so account actions need their own scope before they can be registered.

## Not actions

The remaining 86 methods do not change saved state and stay UI-only. They form the audited list step 5 asks for.

Selection: `select`, `selectTimelineItem`, `setTimelineSelection`, `ensureTimelineItemSelected`, `selectCaption`, `pickCaption`, `selectOverlay`, `selectTextLayer`, `selectAudioLayer`, `selectVideoFrame`, `clearCanvasSelection`, `clickMedia`, `selectAllMedia`, `clearMediaSelection`, `isTimelineSelected`, `isCaptionSelected`, `isMediaSelected`.

Playback and navigation: `togglePlayback`, `pausePlayback`, `scrub`, `finishScrubbing`, `seekToTimelineTime`, `seekToTranscriptWord`, `stepPlayhead`, `revealOverlay`, `revealOnCanvas`, `goToNextOverlayKey`, `goToPreviousOverlayKey`, `goToNextFramingKey`, `goToPreviousFramingKey`, `showProjectsHome`, `hideProjectsHome`, `toggleAssistant`, `closeAssistant`, `dismissError`, `dismissDictionarySuggestion`.

Gesture bookkeeping and previews: `beginTimelineDrag`, `endTimelineDrag`, `cancelTimelineDrag`, `recoverStrandedTimelineDrag`, `setTimelineLift`, `previewTimelineSelectionMove`, `cancelTimelineSelectionMove`, `previewVideoTrackInsertion`, `laneLanding`, `blocking`, `setActiveTimelineSnap`, `timelineSnapAnchors`, `toggleTimelineSnapping`, `previewFraming`, `framingPreview`, `beginCropping`, `endCropping`, `previewVolume`, `previewVideoTrackVolume`, `previewSoundEffect`, `stopSoundPreview`. The committed end of each gesture is in the tables above.

Reads: `aspects`, `canCrop`, `captionCue`, `displayedOverlay`, `faceBoxAtPlayhead`, `framingBox`, `gradedOverlayImage`, `hasNextOverlayKey`, `hasPreviousOverlayKey`, `isLocked`, `isOverlayKeyed`, `isOverlayTrackHidden`, `isPlayheadOver`, `media`, `overlayKeyAtPlayhead`, `overlayKeys`, `overlaySourceImage`, `overlayTargetCount`, `overlays`, `revealRegions`, `timelineSelectionBounds`, `volume`, `pastePropertiesTitle`.

Clipboard and lifecycle: `copyProperties`, `copyTranscript`, `noteCaptionEdit`, `cancelCurrentOperation`, `start`, `setStatus`. The script also counts `prepareForTermination` as a mutation because it flushes the pending edit on quit; it is lifecycle, not an action.

Two of these deserve a second look. `cancelCurrentOperation` is a real user intent ("stop") and could be a registered action with no arguments. `noteCaptionEdit` runs the dictionary suggestion logic; when caption text becomes an action, the executor should call it so Chirpy edits get the same offer.

## What the inventory changes in the protocol

The schema's `effect` field has `reversibleEdit` and `workflow`. This inventory needs `navigation` (open project, projects home), `destructive` (trash project, remove media with instances), `import`, and `export`. The plan route should refuse destructive effects unless the client confirms them, and the UI should use that same confirmation.

Requests are keyed by project ID and revision. Dictionary and project-list actions are account or workspace scoped, so the request shape needs a scope field before they register.

Roughly a third of the rows above are property sets rather than operations: caption and text style, framing, retouch, background, overlay visibility, volume, filter, aspect ratio. Registering them one operation at a time would produce dozens of near-identical actions. The property descriptor described in the architecture doc should come first, then those rows register as descriptors.

## Suggested order

1. Property sets for caption style, text style, framing, retouch, background, and volume. Done, with the live-slider gap noted above.
2. Timeline editing: trim, split, delete, reorder, transcript words and pauses. These are what a creator means by "edit".
3. Captions and text layer operations.
4. Overlay placement and track state.
5. Audio, media bin, project, export, and undo. Add the new effects and the account scope here.
6. Route the five workflow buttons through the registry, then regenerate this inventory and turn the "not actions" list into the lint allowlist.
