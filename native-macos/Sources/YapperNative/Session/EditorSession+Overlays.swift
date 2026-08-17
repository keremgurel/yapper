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
    func toggleOverlayTrackHidden(_ track: Int) {
        scheduleCompositionCommitResolvingStatus { [self] in
            let lane = OverlayTracks.on(track, in: overlays)
            guard !lane.isEmpty else { return nil }
            let hidden = !lane.allSatisfy { !$0.isVisible }
            updateProject { project in
                guard var overlays = project.overlays else { return }
                for index in overlays.indices where overlays[index].lane == track {
                    overlays[index].isHidden = hidden ? true : nil
                }
                project.overlays = overlays
                project.updatedAt = Date()
            }
            return hidden ? "Overlay track hidden" : "Overlay track shown"
        }
    }

    /// Deleting a lane is the one edit that closes the stack up: the lane is
    /// gone, so nothing should be left where it used to be.
    func removeOverlayTrack(_ track: Int) async {
        let lane = OverlayTracks.on(track, in: overlays)
        guard !lane.isEmpty else { return }
        await commitTimelineEdit(successStatus: "Overlay track deleted · ⌘Z to undo") {
            updateProject { project in
                let kept = (project.overlays ?? []).filter { $0.lane != track }
                project.overlays = OverlayTracks.compacted(kept)
            }
            reconcileTimelineSelection()
            return true
        }
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
        var updated = overlay
        let clamped = crop.clamped
        updated.crop = clamped.isFull ? nil : clamped
        let aspects = aspects(for: updated)
        updated.height = OverlayFrame.height(
            forWidth: updated.width,
            mediaAspect: aspects.media,
            frameAspect: aspects.frame
        )
        // Where the creator put it, not where a crop would rather have it. The
        // box's height changes to fit what the crop kept, and pulling the box
        // back inside the frame afterwards dragged the picture down off the top
        // edge they had just placed it against.
        updated.y = OverlayCanvasGeometry.placedOrigin(updated.y, extent: updated.height)
        commitOverlayEdit(updated)
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
        guard overlays.contains(where: { $0.id == overlay.id }) else { return }
        scheduleCompositionCommit { [self] in
            updateProject { project in
                guard let index = project.overlays?.firstIndex(where: { $0.id == overlay.id })
                else { return }
                project.overlays?[index].behindSpeaker = behind ? true : nil
                project.updatedAt = Date()
            }
            selectedOverlayID = overlay.id
            return true
        }
    }

    /// Shows or hides one overlay without disturbing its place on the timeline.
    func setOverlayHidden(_ overlay: ProjectOverlay, hidden: Bool) {
        var updated = overlay
        updated.isHidden = hidden ? true : nil
        commitOverlayEdit(updated)
    }

    /// Live during a drag: saved, but the composition is left alone.
    func updateOverlay(_ updated: ProjectOverlay) {
        guard overlays.contains(where: { $0.id == updated.id }) else { return }
        scheduleVisualCommit { [self] in
            updateProject { project in
                guard let index = project.overlays?.firstIndex(where: { $0.id == updated.id }) else { return }
                project.overlays?[index] = updated
                project.updatedAt = Date()
            }
            if selectedOverlayID != updated.id { selectedOverlayID = updated.id }
            return true
        }
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

    func commitOverlayEdit(_ updated: ProjectOverlay) {
        guard let existing = overlays.first(where: { $0.id == updated.id }) else { return }

        // On a keyed cutaway, moving or resizing it writes a key here instead
        // of moving the whole card, which is the second half of the same
        // gesture the main track's punch-in uses: mark a moment, move the
        // playhead, drag, and the move writes itself.
        if OverlayKeyTrack.isKeyed(existing) {
            let time = overlayTime(of: existing)
            let box = OverlayBox(
                x: updated.x,
                y: updated.y,
                width: updated.width,
                height: updated.height
            )
            guard OverlayKeyTrack.box(of: existing, at: time) != box else { return }
            let keyed = OverlayKeyTrack.setting(box, at: time, in: existing)
            scheduleCompositionCommit(settleFor: .milliseconds(50)) { [self] in
                updateProject { project in
                    guard let index = project.overlays?.firstIndex(where: { $0.id == updated.id })
                    else { return }
                    project.overlays?[index] = keyed
                    project.updatedAt = Date()
                }
                selectedOverlayID = updated.id
                return true
            }
            return
        }

        // A still the canvas draws itself is already on screen in its new place
        // by the time this runs, so it is saved without rebuilding anything.
        // One the composition draws is not: skipping the rebuild there leaves
        // the picture exactly where it was while its box moves away without it,
        // which is what dragging an overlay set to sit behind the speaker did.
        let drawnByTheCanvas = media(for: updated)?.isImage == true
            && !project.compositedOverlayIDs.contains(updated.id)
        guard !drawnByTheCanvas else {
            updateOverlay(updated)
            return
        }
        scheduleCompositionCommit { [self] in
            updateProject { project in
                guard let index = project.overlays?.firstIndex(where: { $0.id == updated.id }) else { return }
                project.overlays?[index] = updated
                project.updatedAt = Date()
            }
            selectedOverlayID = updated.id
            return true
        }
    }

    /// Grows or shrinks the overlay around its own centre.
    func scaleOverlay(_ overlay: ProjectOverlay, toWidth width: Double) {
        let aspects = aspects(for: overlay)
        commitOverlayEdit(
            OverlayCanvasGeometry.scaled(
                overlay: overlay,
                toWidth: width,
                mediaAspect: aspects.media,
                frameAspect: aspects.frame
            )
        )
    }

    /// Blows the overlay up to cover the whole frame, for a straight cutaway.
    func fillFrameWithOverlay(_ overlay: ProjectOverlay) {
        commitOverlayEdit(OverlayCanvasGeometry.filling(overlay: overlay))
    }

    /// Puts the overlay back where a freshly added one lands.
    func resetOverlayFrame(_ overlay: ProjectOverlay) {
        let aspects = aspects(for: overlay)
        let box = OverlayFrame.introduced(
            mediaAspect: aspects.media,
            frameAspect: aspects.frame
        )
        var reset = overlay
        reset.x = box.x
        reset.y = box.y
        reset.width = box.width
        reset.height = box.height
        commitOverlayEdit(reset)
    }

    func deleteOverlay(_ id: UUID) async {
        guard overlays.contains(where: { $0.id == id }) else { return }
        selectTimelineItem(.overlay(id))
        await deleteTimelineSelection(successStatus: "Overlay removed · ⌘Z to undo")
    }

    /// Grades the whole project. The look reaches the preview through the
    /// composition, so this rebuilds it rather than only saving.
    func setVisualFilter(_ filter: VisualFilter) {
        guard filter != project.resolvedVisualFilter else { return }
        scheduleCompositionCommit(successStatus: filter.id == .original ? "Filter cleared" : "\(filter.id.title) filter applied") { [self] in
            updateProject { project in
                project.visualFilter = filter.isNeutral && filter.id == .original ? nil : filter
                project.updatedAt = Date()
            }
            gradedOverlayImages.removeAll()
            return true
        }
    }

    /// The speaker's own track, hidden or silenced. Both keep every clip
    /// exactly where it is.
    func toggleVideoTrackHidden() {
        scheduleCompositionCommitResolvingStatus { [self] in
            let hidden = !project.isVideoTrackHidden
            updateProject { project in
                project.videoTrackHidden = hidden ? true : nil
                project.updatedAt = Date()
            }
            return hidden ? "Video track hidden" : "Video track shown"
        }
    }

    func toggleVideoTrackMuted() {
        scheduleCompositionCommitResolvingStatus { [self] in
            let muted = !project.isVideoTrackMuted
            updateProject { project in
                project.videoTrackMuted = muted ? true : nil
                project.updatedAt = Date()
            }
            return muted ? "Video track muted" : "Video track unmuted"
        }
    }

    /// Empties the video track. The recordings stay in the media list, so the
    /// footage can be laid back down, and ⌘Z brings the cut back as it was.
    func clearVideoTrack() async {
        guard !project.clips.isEmpty else { return }
        await commitTimelineEdit(successStatus: "Video track cleared · ⌘Z to undo") {
            updateProject { $0.clips = [] }
            reconcileTimelineSelection()
            return true
        }
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
