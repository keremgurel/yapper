import Foundation

/// Keyframing the main track's framing: the diamond, the arrows, and what the
/// canvas is looking at when the playhead moves.
///
/// A punch-in is two keys and the line between them. Everything here is about
/// putting those two keys somewhere useful without the creator having to think
/// about interpolation: press the diamond where it should start, move the
/// playhead, drag the picture, and the second key writes itself. That last part
/// is the whole trick, and it is `commitFraming`'s job rather than this file's.
@MainActor
extension EditorSession {
    /// Where the playhead is inside the clip it is over, in that media's own
    /// seconds. The coordinate every key is stored in.
    var framingSourceTime: Double {
        project.clip(at: min(currentTime, project.duration))?.sourceTime ?? 0
    }

    /// Whether the clip under the playhead moves at all.
    var isFramingKeyed: Bool {
        framingClip.map(VideoFramingTrack.isKeyed) ?? false
    }

    /// The key exactly under the playhead, if there is one.
    var framingKeyAtPlayhead: FramingKey? {
        guard let clip = framingClip else { return nil }
        return VideoFramingTrack.key(of: clip, atSource: framingSourceTime)
    }

    /// Every key on the clip under the playhead, for drawing them.
    var framingKeys: [FramingKey] {
        framingClip.map(VideoFramingTrack.keys(of:)) ?? []
    }

    // MARK: - The diamond

    /// Adds a key here, or takes away the one that is here.
    ///
    /// The first key on a clip is written at whatever the clip is already
    /// framed at, so pressing this never changes the picture. That matters more
    /// than it sounds: the whole gesture is "mark here, move there, change it",
    /// and a diamond that moved something would break the first half.
    func toggleFramingKey() {
        guard let clip = framingClip else { return }
        let time = framingSourceTime
        let updated: TimelineClip
        let successStatus: String
        if VideoFramingTrack.key(of: clip, atSource: time) != nil {
            updated = VideoFramingTrack.removingKey(atSource: time, in: clip)
            successStatus = "Keyframe removed"
        } else {
            updated = VideoFramingTrack.setting(
                displayedFraming,
                atSource: time,
                in: clip
            )
            successStatus = "Keyframe added at \(formatTime(currentTime))"
        }
        replaceFramingClip(updated, successStatus: successStatus)
    }

    /// Drops every key on this clip, leaving it framed as it is right now.
    func clearFramingKeys() {
        guard let clip = framingClip, VideoFramingTrack.isKeyed(clip) else { return }
        replaceFramingClip(
            VideoFramingTrack.clearingKeys(atSource: framingSourceTime, in: clip),
            successStatus: "Keyframes cleared"
        )
    }

    // MARK: - The arrows

    var hasPreviousFramingKey: Bool {
        guard let clip = framingClip else { return false }
        return VideoFramingTrack.previousKey(of: clip, before: framingSourceTime) != nil
    }

    var hasNextFramingKey: Bool {
        guard let clip = framingClip else { return false }
        return VideoFramingTrack.nextKey(of: clip, after: framingSourceTime) != nil
    }

    /// Moves the playhead to the key before this one, so the two ends of a move
    /// can be compared without hunting for them.
    func goToPreviousFramingKey() {
        guard
            let clip = framingClip,
            let key = VideoFramingTrack.previousKey(of: clip, before: framingSourceTime)
        else { return }
        seekToKey(key, in: clip)
    }

    func goToNextFramingKey() {
        guard
            let clip = framingClip,
            let key = VideoFramingTrack.nextKey(of: clip, after: framingSourceTime)
        else { return }
        seekToKey(key, in: clip)
    }

    private func seekToKey(_ key: FramingKey, in clip: TimelineClip) {
        let clipStart = project.timelineStart(for: clip.id) ?? 0
        seekToTimelineTime(clipStart + (key.at - clip.sourceStart))
    }

    // MARK: - Dragging one on the timeline

    /// Moves a key along its own clip, which is how the speed of a push-in is
    /// set: closer together is a snap, further apart is a slow drift.
    func moveFramingKey(in clip: TimelineClip, fromSource: Double, toSource: Double) {
        var keys = VideoFramingTrack.keys(of: clip)
        guard let index = keys.firstIndex(where: {
            abs($0.at - fromSource) < VideoFramingTrack.minimumGap
        }) else { return }
        let gap = VideoFramingTrack.minimumGap
        let lower = index > 0 ? keys[index - 1].at + gap : clip.sourceStart
        let upper = index < keys.count - 1 ? keys[index + 1].at - gap : clip.sourceEnd
        guard upper > lower else { return }
        keys[index].at = min(upper, max(lower, toSource))

        var updated = clip
        updated.framingKeys = keys.sorted { $0.at < $1.at }
        guard updated != clip else { return }
        replaceFramingClip(updated)
    }

    func removeFramingKey(in clip: TimelineClip, atSource time: Double) {
        let updated = VideoFramingTrack.removingKey(atSource: time, in: clip)
        guard updated != clip else { return }
        replaceFramingClip(updated, successStatus: "Keyframe removed")
    }

    // MARK: - Writing

    /// Saves a clip that only differs in how it is framed.
    func replaceFramingClip(_ clip: TimelineClip, successStatus: String = "Ready") {
        scheduleCompositionCommit(
            settleFor: .milliseconds(50),
            successStatus: successStatus
        ) { [self] in
            guard let index = project.clips.firstIndex(where: { $0.id == clip.id }) else { return false }
            updateProject { project in
                project.clips[index] = clip
                project.updatedAt = Date()
            }
            return true
        }
    }
}
