# Independent overlay crops and framing keyframes

## Contract

- Each timeline overlay owns its crop and keys. Media files are never edited.
- Crop opens on one portion by default, including from the media bin. The sheet offers an explicit all-occurrences scope.
- A key captures source crop plus output position/size. Before animation is enabled, crop edits are static; afterwards they write at the selected portion's local playhead time.
- Adding a key samples the visible interpolation, never the original saved box. Moving/resizing preserves crop keys. Clearing animation holds the current appearance.
- Legacy box-only keys decode unchanged and inherit the static crop.
- Animated source crops are enabled for raster image overlays. Generated scenes/video retain their existing static crop and position-key behavior.

## Delivery sequence

1. Extend and test the pure key track (crop interpolation, snapshots, remove/clear, relative timing).
2. Default crop requests to one portion; explicitly scope batch edits and pin key time.
3. Wire crop and transform authoring into the existing diamond/previous/next controls.
4. Render animated image framing through the shared compositor evaluator in playback and export, retaining layer order and hidden-track behavior.
5. Preserve animation during splitting and trimming; test save/reload and sibling isolation.
6. Run focused tests and a synthetic rendered export; build/package and exercise the installed UI. Preserve unrelated working-tree changes and do not push without a new request.

## Verification gates

- Two overlays sharing one source remain independent after crop/key edits.
- Midpoint crop and output box, endpoint holds, old JSON, key insertion/removal/clear.
- Timeline relocation carries animation; splits/trims preserve source-time framing.
- Raster export samples confirm different sections at different times and match evaluated geometry.
- Actual UI: crop a single portion, set two keys, seek between them, move/resize, reopen crop.

## How to use

1. Select a picture portion on the timeline and open **Crop…**. The **Edit** menu selects a single occurrence by default; all-occurrences is opt-in.
2. For a static crop, drag the source window and press **Done**. Split portions retain this crop but can be edited independently afterwards.
3. For a move, set the starting crop and click **Add keyframe**. Scrub the local time slider and drag/resize the source window; this adds the next crop key automatically.
4. Close Crop, move the playhead, and drag/resize the overlay on the video to set its output placement at that key. Crop and placement share the same key times.
5. Use the inspector's previous/next arrows to inspect keys. **Clear** removes animation while retaining the frame currently displayed.

## Verification record

- 47 focused tests pass, including a self-contained synthetic MP4 export and playback pixel checks (no mounted reference media required).
- Actual app QA confirmed source-window interpolation, automatic key creation from crop resize/pan, independent sibling crop, output move/resize, and restoration of the earlier frame.
- UI QA found and corrected stale keyframe navigation caused by missing playback-clock observation.
- QA uses a separate synthetic project; no real editing project is modified by the test.
