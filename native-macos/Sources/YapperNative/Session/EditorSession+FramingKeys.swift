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
    @discardableResult
    func toggleFramingKey() -> Task<AppActionResult?, Never> {
        guard let clip = framingClip else { return Task { nil } }
        let time = framingSourceTime
        if VideoFramingTrack.key(of: clip, atSource: time) != nil {
            return framingKeyAction(.remove, clip: clip, at: time)
        }
        return framingKeyAction(.set, clip: clip, at: time, framing: displayedFraming)
    }

    /// Drops every key on this clip, leaving it framed as it is right now.
    @discardableResult
    func clearFramingKeys() -> Task<AppActionResult?, Never> {
        guard let clip = framingClip, VideoFramingTrack.isKeyed(clip) else { return Task { nil } }
        return framingKeyAction(.clear, clip: clip, at: framingSourceTime)
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
        seekToTimelineTime(clipStart + clip.timelineOffset(forSource: key.at))
    }

    // MARK: - Dragging one on the timeline

    /// Moves a key along its own clip, which is how the speed of a push-in is
    /// set: closer together is a snap, further apart is a slow drift.
    func moveFramingKey(in clip: TimelineClip, fromSource: Double, toSource: Double) {
        Task { await performAppAction(VideoFramingKeyInput(clipID: clip.id, sourceTime: fromSource,
            operation: .move, destination: toSource, scale: nil, x: nil, y: nil, rotation: nil)) }
    }

    @discardableResult
    func removeFramingKey(in clip: TimelineClip, atSource time: Double) -> Task<AppActionResult?, Never> {
        guard VideoFramingTrack.removingKey(atSource: time, in: clip) != clip else { return Task { nil } }
        return framingKeyAction(.remove, clip: clip, at: time)
    }

    // MARK: - Writing

    /// Every key edit goes through the keyframe action Chirpy uses, so the
    /// diamond, the timeline marker and a request write the same keys.
    @discardableResult
    func framingKeyAction(_ operation: OverlayKeyOperation, clip: TimelineClip, at time: Double,
                          framing: VideoFraming? = nil) -> Task<AppActionResult?, Never> {
        let input = VideoFramingKeyInput(clipID: clip.id, sourceTime: min(86_400, max(0, time)), operation: operation,
                                         destination: nil, scale: framing?.scale, x: framing?.x, y: framing?.y,
                                         rotation: framing.map { min(180, max(-180, $0.rotation)) })
        return Task { await performAppAction(input) }
    }
}
