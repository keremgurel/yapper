import CoreGraphics
import Foundation

/// Framing the main track: which clip is being framed, and every way of
/// changing it.
extension EditorSession {
    /// The clip the framing controls act on: the one under the playhead, which
    /// is the one you can see.
    var framingClip: TimelineClip? {
        guard let hit = project.clip(at: min(currentTime, project.duration)) else { return nil }
        return project.clips[hit.index]
    }

    /// What the canvas draws: the drag if one is running, and otherwise how the
    /// clip is framed at the playhead.
    ///
    /// At the playhead, not "the clip's framing", because a keyed clip has no
    /// single framing: it is 100% at one end of a push-in and 140% at the
    /// other, and what the handles should show is whichever of those you are
    /// looking at.
    var displayedFraming: VideoFraming {
        if let dragged = canvasDrag.framing { return dragged }
        guard let clip = framingClip else { return .identity }
        return VideoFramingTrack.framing(of: clip, atSource: framingSourceTime)
    }

    /// The shape of the footage under the playhead, so the canvas can draw the
    /// framing box around the picture rather than around the whole frame.
    /// Falls back to the frame's own shape for footage that has not been
    /// probed, which draws a box on the frame edge: wrong by less than
    /// drawing nothing.
    var framingSourceAspect: Double {
        guard
            let clip = framingClip,
            let media = project.media.first(where: { $0.id == clip.mediaID })
        else { return project.resolvedAspectRatio }
        return CompositionBuilder.aspect(of: media)
    }

    /// Where the picture sits on a stage this size, which is where the framing
    /// handles go.
    func framingBox(in stageSize: CGSize) -> CGRect {
        VideoFramingGeometry.mediaBox(
            framing: displayedFraming,
            sourceAspect: framingSourceAspect,
            stageSize: stageSize
        )
    }

    /// How far the player has to be pushed for the picture to look like
    /// `displayedFraming` while the composition still renders what it was built
    /// with. `nil` once the two agree, which is most of the time.
    ///
    /// This covers a gesture in flight and the wait after it lets go alike: the
    /// commit changes what is wanted, the rebuild changes what is rendered, and
    /// the picture is carried across both without ever moving backwards.
    var framingPreviewTransform: (scale: Double, x: Double, y: Double)? {
        guard let clip = framingClip else { return nil }
        return VideoFramingGeometry.previewTransform(
            // What the composition is showing at this moment, which for a keyed
            // clip is a different answer every frame.
            from: renderedFraming.framing(for: clip.id, atSource: framingSourceTime),
            to: displayedFraming
        )
    }

    /// The zoom that would fill the output frame with this clip's footage,
    /// leaving no bars. `nil` when the shapes already match, so the button that
    /// offers it can stand down.
    var framingFillScale: Double? {
        guard
            let clip = framingClip,
            let media = project.media.first(where: { $0.id == clip.mediaID })
        else { return nil }
        let scale = VideoFramingGeometry.fillingScale(
            sourceAspect: CompositionBuilder.aspect(of: media),
            frameAspect: project.resolvedAspectRatio
        )
        guard scale > 1.001 else { return nil }
        return scale
    }

    // MARK: - Selection

    /// Puts the picture itself in hand. Clicking the video is how you reach the
    /// framing handles, so it has to clear whatever else was selected, the same
    /// way selecting an overlay does.
    func selectVideoFrame() {
        guard !project.clips.isEmpty else { return }
        selectedOverlayID = nil
        selectedTextLayerID = nil
        setSelectedCaptionIDs([])
        guard !isVideoFrameSelected else { return }
        isVideoFrameSelected = true
    }

    func deselectVideoFrame() {
        guard isVideoFrameSelected else { return }
        isVideoFrameSelected = false
    }

    // MARK: - Editing

    /// Saves a framing gesture, once, when it lets go. Nothing is written while
    /// it runs: the composition has to be rebuilt for the player to show a new
    /// framing, and rebuilding per mouse event is exactly the stutter the
    /// canvas drags were just cured of.
    func commitFraming(_ framing: VideoFraming, clipID: UUID) {
        guard let index = project.clips.firstIndex(where: { $0.id == clipID }) else { return }
        let clip = project.clips[index]

        // On a keyed clip, changing the framing writes a key here rather than
        // changing the whole clip. That is the second half of the punch-in
        // gesture: mark the start, move the playhead, drag the picture, and the
        // key that makes it a move writes itself. Changing every frame instead
        // would silently flatten the move you were halfway through making.
        if VideoFramingTrack.isKeyed(clip) {
            let time = framingSourceTime
            guard VideoFramingTrack.framing(of: clip, atSource: time) != framing else { return }
            replaceFramingClip(
                VideoFramingTrack.setting(framing, atSource: time, in: clip),
                successStatus: "Keyframe at \(formatTime(currentTime)) · \(framing.percent)%"
            )
            return
        }

        // Framing a clip that was marquee-selected with others frames all of
        // them, so the question is not whether this clip changes but whether
        // any of them does: typing the position the current clip already has is
        // how a creator says "and these too".
        let targets = framingTargets(for: clipID)
        guard ApplyToAll.changeCount(
            from: project.clips,
            to: ApplyToAll.framing(framing, to: project.clips, ids: targets)
        ) > 0 else { return }
        // Barely a wait at all. The debounce is there to coalesce a gesture's
        // worth of edits, and framing commits once the gesture is already over;
        // all a longer settle does here is hold the picture at the wrong size
        // for another fifth of a second. Enough remains to catch the stepper
        // being clicked repeatedly.
        // A slider or a stepper is a burst of these, and the debounce below
        // holds the composition back until the burst ends. The preview keeps
        // the cutaways where they belong in the meantime.
        previewFraming(framing, clipID: clipID)
        let what = framing.isIdentity ? "Framing reset" : "Framing set to \(framing.percent)%"
        scheduleCompositionCommit(
            settleFor: .milliseconds(50),
            successStatus: targets.count > 1 ? "\(what) on \(targets.count) clips" : what
        ) { [self] in
            guard project.clips.contains(where: { $0.id == clipID }) else { return false }
            updateProject { project in
                project.clips = ApplyToAll.framing(framing, to: project.clips, ids: targets)
                project.updatedAt = Date()
            }
            return true
        }
    }

    /// The clips a framing change lands on: the one being framed, and anything
    /// selected alongside it on the timeline.
    private func framingTargets(for clipID: UUID) -> Set<UUID> {
        let selected = selectedClipIDs
        guard selected.count > 1, selected.contains(clipID) else { return [clipID] }
        return selected
    }

    /// Slides the picture from the inspector, keeping the zoom.
    func setFramingOffset(x: Double, y: Double) {
        guard let clip = framingClip else { return }
        let current = displayedFraming
        commitFraming(VideoFraming(scale: current.scale, x: x, y: y), clipID: clip.id)
    }

    /// Sets the zoom from the inspector, keeping wherever the picture has been
    /// slid to.
    func setFramingScale(_ scale: Double) {
        guard let clip = framingClip else { return }
        // From what is on screen now, so a stepper press on a keyed clip nudges
        // the moment you are looking at rather than the clip's first key.
        let current = displayedFraming
        commitFraming(
            VideoFraming(scale: scale, x: current.x, y: current.y),
            clipID: clip.id
        )
    }

    func resetFraming() {
        guard let clip = framingClip else { return }
        commitFraming(.identity, clipID: clip.id)
    }

    /// Zooms until the footage covers the frame with nothing left over, which
    /// is what landscape footage in a portrait frame almost always wants.
    func fillFrameWithVideo() {
        guard let clip = framingClip, let scale = framingFillScale else { return }
        commitFraming(VideoFraming(scale: scale, x: 0, y: 0), clipID: clip.id)
    }
}
