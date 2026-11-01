import CoreGraphics
import Foundation

/// Placing an overlay on the frame: where it sits, how big it is, and what
/// happens to the composition when either changes.
///
/// Images are drawn twice, by the canvas while editing and by Core Animation on
/// export, so moving one only has to be saved. A video cutaway is a track in
/// the composition, so moving one has to rebuild it: that lands on the end of
/// the gesture, never on every frame of it.
@MainActor
extension EditorSession {
    var selectedOverlay: ProjectOverlay? {
        guard let selectedOverlayID else { return nil }
        return project.overlays?.first { $0.id == selectedOverlayID }
    }

    var overlays: [ProjectOverlay] { project.overlays ?? [] }

    func media(for overlay: ProjectOverlay) -> ProjectMedia? {
        project.media.first { $0.id == overlay.mediaID }
    }

    /// The overlays on screen at a given moment, back to front.
    func overlays(at time: Double) -> [ProjectOverlay] {
        OverlayTracks.backToFront(overlays).filter {
            $0.isVisible
                && time >= $0.timelineStart
                && time <= $0.timelineStart + $0.duration
        }
    }

    /// How many overlay lanes the timeline is drawing. None until something is
    /// laid over the speaker.
    var overlayTrackCount: Int {
        overlays.isEmpty ? 0 : OverlayTracks.count(overlays)
    }

    /// The timeline shows a track once there is something on it, and not
    /// before: an untouched recording is one row, not five empty ones.
    var timelineRowLayout: TimelineRowLayout {
        TimelineRowLayout(
            hasText: !(project.textLayers ?? []).isEmpty,
            overlayTrackCount: overlayTrackCount,
            // Stored, not visible: hiding the captions must not take away the row
            // carrying the eye that shows them again.
            hasCaptions: hasCaptions,
            audioTrackCount: AudioTracks.count(for: project.audioLayers ?? [])
        )
    }

    /// Moves an overlay to another lane, refusing when something is already
    /// there at that moment: two pictures on one lane at one time is what the
    /// lanes exist to prevent.
    @discardableResult
    func moveOverlay(_ overlay: ProjectOverlay, toTrack track: Int) -> Bool {
        let target = max(0, track)
        guard target != overlay.lane else { return false }
        guard !OverlayTracks.isOccupied(
            target,
            by: (overlay.id, overlay.timelineStart, overlay.duration),
            in: overlays
        ) else {
            setStatus("That lane is busy at this point in the video")
            return false
        }
        var moved = overlay
        moved.track = target
        commitOverlayEdit(moved)
        return true
    }

    /// Lifts an overlay onto a new lane above every other, for when the one it
    /// is on is busy.
    func liftOverlayToNewTrack(_ overlay: ProjectOverlay) {
        var moved = overlay
        moved.track = OverlayTracks.top(overlays) + 1
        commitOverlayEdit(moved)
    }

    /// True when every overlay on a lane is hidden, which is what the eye on
    /// the rail shows.
    func isOverlayTrackHidden(_ track: Int) -> Bool {
        let lane = OverlayTracks.on(track, in: overlays)
        return !lane.isEmpty && lane.allSatisfy { !$0.isVisible }
    }

    /// The eye on the rail belongs to the whole lane: one overlay showing means
    /// the lane is showing, and the toggle turns all of them off together.
    @discardableResult
    func toggleOverlayTrackHidden(_ track: Int) -> Task<AppActionResult?, Never> {
        guard !OverlayTracks.on(track, in: overlays).isEmpty else { return Task { nil } }
        return Task {
            await performAppAction(resolvedAtTurn: { OverlayTrackInput(track: track, operation: .setHidden, hidden: !$0.isOverlayTrackHidden(track)) })
        }
    }

    /// Deleting a lane is the one edit that closes the stack up: the lane is
    /// gone, so nothing should be left where it used to be.
    func removeOverlayTrack(_ track: Int) async {
        await performAppAction(OverlayTrackInput(track: track, operation: .remove, hidden: nil))
    }

    /// The shape of what the overlay shows, and the shape of the frame it is
    /// being placed on. Both are needed to turn a width into a height, because
    /// the two are fractions of different edges.
    ///
    /// The first is the shape of the crop, not of the media: a box that hugged
    /// the whole picture after half of it had been cropped away would letterbox
    /// what is left.
    func aspects(for overlay: ProjectOverlay) -> (media: Double, frame: Double) {
        let frame = project.resolvedAspectRatio
        guard let media = media(for: overlay) else { return (frame, frame) }
        return (
            OverlayFrame.shownAspect(
                mediaAspect: CompositionBuilder.aspect(of: media),
                crop: overlay.resolvedCrop
            ),
            frame
        )
    }

    /// Keeps or discards part of the overlay's own picture. The box stays where
    /// it is and keeps its width; only its height moves, so the kept rectangle
    /// fills it exactly.
    func setOverlayCrop(_ overlay: ProjectOverlay, crop: OverlayCrop) {
        applyCrop(crop, to: CropRequest(
            mediaID: overlay.mediaID, name: media(for: overlay)?.name ?? "Image",
            overlayIDs: [overlay.id], crop: overlay.resolvedCrop,
            keyTime: overlayTime(of: overlay)
        ))
    }

    /// Cuts the speaker out of their own clip and draws them again over this
    /// overlay, so the overlay reads as sitting behind them.
    ///
    /// Committed here rather than through `commitOverlayEdit`, which is the
    /// path for moving and resizing and treats every edit as one: on a keyed
    /// overlay it would read this as a new keyframe and drop it, and on a still
    /// it would save without rebuilding the composition. This changes how the
    /// whole project is composited, so it always rebuilds.
    func setOverlayBehindSpeaker(_ overlay: ProjectOverlay, behind: Bool) {
        Task { await performAppAction(OverlayPropertiesInput(overlayIDs: [overlay.id], all: nil,
            hidden: nil, behindSpeaker: behind, sourceStart: nil, timelineStart: nil, duration: nil, track: nil)) }
    }

    /// Visibility changes are independent of placement keys.
    func setOverlayHidden(_ overlay: ProjectOverlay, hidden: Bool) {
        Task { await performAppAction(OverlayPropertiesInput(overlayIDs: [overlay.id], all: nil,
            hidden: hidden, behindSpeaker: nil, sourceStart: nil, timelineStart: nil, duration: nil, track: nil)) }
    }

    /// At the end of a gesture, or from the inspector. Every edit to an overlay
    /// lands here, whether it moved the box, the lane or the in point.
    ///
    /// A video cutaway lives in the composition, so the player only shows any of
    /// those once that has been rebuilt, which is debounced rather than run per
    /// step. Persisting alone is enough for a still and not enough for anything
    /// else: a second commit that only saved is what left trimmed and moved
    /// video overlays playing exactly as they had before.
    /// Where an overlay is right now, which for a keyed one is a different box
    /// every frame. Everything that draws a cutaway asks this rather than
    /// reading the saved box.
    func displayedOverlay(_ overlay: ProjectOverlay) -> ProjectOverlay {
        guard OverlayKeyTrack.isKeyed(overlay) else { return overlay }
        var shown = overlay
        let box = OverlayKeyTrack.box(of: overlay, atTimeline: currentTime)
        shown.x = box.x
        shown.y = box.y
        shown.width = box.width
        shown.height = box.height
        shown.crop = OverlayKeyTrack.crop(of: overlay, at: overlayTime(of: overlay))
        return shown
    }

    /// How far into a cutaway the playhead is, the coordinate its keys live in.
    func overlayTime(of overlay: ProjectOverlay) -> Double {
        min(max(0, currentTime - overlay.timelineStart), max(0, overlay.duration))
    }

    var keyedOverlay: ProjectOverlay? {
        guard let id = selectedOverlayID else { return nil }
        return overlays.first { $0.id == id }
    }

    /// The other cutaways a box change lands on: whatever is selected on the
    /// timeline alongside this one. Only a change that actually moved or
    /// resized the box spreads; trimming one of a selected run, or dropping it
    /// on another lane, is about that one cutaway.
    private func overlayFrameTargets(
        _ updated: ProjectOverlay,
        from existing: ProjectOverlay
    ) -> Set<UUID> {
        let movedOrResized = updated.x != existing.x
            || updated.y != existing.y
            || updated.width != existing.width
            || updated.height != existing.height
        guard movedOrResized else { return [] }
        var ids = selectedOverlayIDs
        // Dragging a cutaway that is not part of the selection is how that one
        // gets picked up, so it moves alone.
        guard ids.contains(updated.id) else { return [] }
        ids.remove(updated.id)
        return ids
    }

    @discardableResult
    func commitOverlayEdit(_ updated: ProjectOverlay) -> Task<AppActionResult?, Never> {
        guard let existing = overlays.first(where: { $0.id == updated.id }) else { return Task { nil } }
        // Timing, lane and visibility: a drag along the timeline, or the lane
        // menu. The overlay properties action takes exactly those fields.
        if let timing = OverlayPropertiesInput(timingOf: updated, from: existing) {
            return Task { await performAppAction(timing) }
        }

        // On a keyed cutaway, moving or resizing it writes a key here instead
        // of moving the whole card, which is the second half of the same
        // gesture the main track's punch-in uses: mark a moment, move the
        // playhead, drag, and the move writes itself.
        if OverlayKeyTrack.isKeyed(existing) {
            guard updated.rotation == existing.rotation else {
                return Task { await performAppAction(OverlayFrameInput(ids: [existing.id], rotation: updated.resolvedRotation)) }
            }
            guard isPlayheadOver(existing) else {
                setStatus("Move the playhead over this portion to edit a keyframe")
                return Task { nil }
            }
            let time = overlayTime(of: existing)
            let box = OverlayBox(x: updated.x, y: updated.y, width: updated.width, height: updated.height)
            guard OverlayKeyTrack.box(of: existing, at: time) != box else { return Task { nil } }
            return Task { await performAppAction(OverlayFrameInput(ids: [existing.id], frameOf: updated, time: time)) }
        }

        // The rest of a marquee-selected run takes the same box, except keyed
        // ones, which keep their move.
        let spread = overlayFrameTargets(updated, from: existing)
            .filter { id in overlays.first { $0.id == id }.map { !OverlayKeyTrack.isKeyed($0) } ?? false }
        let ids = [existing.id] + spread.sorted { $0.uuidString < $1.uuidString }
        return Task { await performAppAction(OverlayFrameInput(ids: ids, frameOf: updated, time: nil)) }
    }

    /// The size slider while it moves: the canvas draws the draft and nothing
    /// is saved until it is let go (`scaleOverlay`).
    func previewOverlayScale(_ overlay: ProjectOverlay, toWidth width: Double) {
        if canvasDrag.overlayOrigin?.id != overlay.id { canvasDrag.beginOverlay(overlay) }
        canvasDrag.updateOverlay(scaled(overlay, toWidth: width))
    }

    /// Grows or shrinks the overlay around its own centre, saved through the
    /// frame action. The slider's draft stays on the canvas until it lands.
    func scaleOverlay(_ overlay: ProjectOverlay, toWidth width: Double) async {
        _ = canvasDrag.holdOverlay()
        _ = await commitOverlayEdit(scaled(overlay, toWidth: width)).value
        canvasDrag.releaseOverlay(overlay.id)
    }

    private func scaled(_ overlay: ProjectOverlay, toWidth width: Double) -> ProjectOverlay {
        let aspects = aspects(for: overlay)
        return OverlayCanvasGeometry.scaled(overlay: overlay, toWidth: width, mediaAspect: aspects.media, frameAspect: aspects.frame)
    }

    /// Blows the overlay up to cover the whole frame, for a straight cutaway.
    func fillFrameWithOverlay(_ overlay: ProjectOverlay) {
        setOverlayFrame(overlay, fit: .full)
    }

    func resetOverlayFrame(_ overlay: ProjectOverlay) {
        setOverlayFrame(overlay, fit: .card)
    }

    private func setOverlayFrame(_ overlay: ProjectOverlay, fit: OverlayFrameFit) {
        if OverlayKeyTrack.isKeyed(overlay), !isPlayheadOver(overlay) {
            setStatus("Move the playhead over this portion to edit a keyframe")
            return
        }
        let time = OverlayKeyTrack.isKeyed(overlay) ? overlayTime(of: overlay) : nil
        // A multi-selection follows the same box, as it does during a canvas
        // resize. Other keyed overlays retain their own moves.
        let companions = time == nil && selectedOverlayIDs.contains(overlay.id)
            ? overlays.filter { $0.id != overlay.id && selectedOverlayIDs.contains($0.id) && !OverlayKeyTrack.isKeyed($0) }.map(\.id) : []
        if companions.isEmpty {
            Task { await performAppAction(OverlayFrameInput(overlayIDs: [overlay.id], all: nil, fit: fit,
                x: nil, y: nil, width: nil, height: nil, rotation: nil, time: time)) }
        } else {
            let aspects = aspects(for: overlay)
            let box = fit == .full ? (x: 0.0, y: 0.0, width: 1.0, height: 1.0)
                : OverlayFrame.introduced(mediaAspect: aspects.media, frameAspect: aspects.frame)
            Task { await performAppAction(OverlayFrameInput(overlayIDs: [overlay.id] + companions, all: nil, fit: nil,
                x: box.x, y: box.y, width: box.width, height: box.height, rotation: nil, time: nil)) }
        }
    }

    func deleteOverlay(_ id: UUID) async {
        guard overlays.contains(where: { $0.id == id }) else { return }
        selectTimelineItem(.overlay(id))
        await deleteTimelineSelection(successStatus: "Overlay removed · ⌘Z to undo")
    }

    /// Grades the whole project, through the project settings action Chirpy
    /// uses. The look reaches the preview through the composition, so the
    /// action rebuilds it rather than only saving.
    func setVisualFilter(_ filter: VisualFilter) async {
        guard filter != project.resolvedVisualFilter else { return }
        await performAppAction(ProjectSettingsInput(filter: VisualFilterInput(rawValue: filter.id.rawValue),
                                                    filterStrength: min(1, max(0, filter.strength))))
    }

    /// The speaker's own track, hidden or silenced. Both keep every clip
    /// exactly where it is.
    @discardableResult
    func toggleVideoTrackHidden() -> Task<AppActionResult, Never> {
        Task { await performAppAction(resolvedAtTurn: { ProjectSettingsInput(videoHidden: !$0.project.isVideoTrackHidden) }) }
    }

    @discardableResult
    func toggleVideoTrackMuted() -> Task<AppActionResult, Never> {
        Task { await performAppAction(resolvedAtTurn: { ProjectSettingsInput(videoMuted: !$0.project.isVideoTrackMuted) }) }
    }

    /// Empties the video track. The recordings stay in the media list, so the
    /// footage can be laid back down, and ⌘Z brings the cut back as it was.
    func clearVideoTrack() async {
        guard !project.clips.isEmpty else { return }
        await performAppAction(ClearTrackInput(track: .video))
    }

    /// Moves the playhead to an overlay so it can be seen while it is edited.
    func revealOverlay(_ overlay: ProjectOverlay) {
        selectOverlay(overlay.id)
        let target = min(
            max(0, project.duration - 0.05),
            overlay.timelineStart + min(0.2, overlay.duration / 2)
        )
        scrub(to: target)
        finishScrubbing(at: target)
    }
}

/// The grade applied to the stills the canvas draws.
///
/// The player's own frames are graded by the compositor, so an ungraded overlay
/// on top of them would be the one thing on the preview that did not match the
/// export.
@MainActor
extension EditorSession {
    func gradedOverlayImage(_ image: CGImage) -> CGImage {
        let filter = project.resolvedVisualFilter
        guard !filter.isNeutral else { return image }
        if let cached = gradedOverlayImages[ObjectIdentifier(image)], cached.filter == filter {
            return cached.image
        }
        let graded = filter.colorMatrix.graded(image) ?? image
        gradedOverlayImages[ObjectIdentifier(image)] = (filter, graded)
        return graded
    }
}
