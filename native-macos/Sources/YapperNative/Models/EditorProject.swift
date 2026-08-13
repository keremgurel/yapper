import Foundation

struct ProjectMedia: Codable, Equatable, Identifiable, Sendable {
    enum Kind: String, Codable, Sendable { case video, image }

    var id: UUID
    var url: URL
    var name: String
    var duration: Double
    var width: Int
    var height: Int
    var hasAudio: Bool
    var kind: Kind?
    /// SHA-256 of the source bytes when the media was imported by a version
    /// that records identity. Optional keeps older project files readable.
    var sourceFingerprint: String?

    init(
        id: UUID = UUID(),
        url: URL,
        name: String,
        duration: Double,
        width: Int,
        height: Int,
        hasAudio: Bool,
        kind: Kind = .video,
        sourceFingerprint: String? = nil
    ) {
        self.id = id
        self.url = url
        self.name = name
        self.duration = duration
        self.width = width
        self.height = height
        self.hasAudio = hasAudio
        self.kind = kind
        self.sourceFingerprint = sourceFingerprint
    }

    var isImage: Bool { kind == .image }
}

struct TimelineClip: Codable, Equatable, Identifiable, Sendable {
    var id: UUID
    var mediaID: UUID
    var sourceStart: Double
    var sourceEnd: Double
    /// How the picture sits in the output frame. `nil` on clips saved before
    /// framing existed, and read as fitted: see `resolvedFraming`.
    ///
    /// What the clip is framed at when it is not keyed. A keyed clip is drawn
    /// from its keys, and this holds the first of them so removing the last key
    /// leaves the picture where it was.
    var framing: VideoFraming?
    /// The framings the picture moves through over this clip, in the media's
    /// own seconds. `nil` or empty means it does not move. See `FramingKey`.
    var framingKeys: [FramingKey]?

    var duration: Double { max(0, sourceEnd - sourceStart) }

    init(
        id: UUID = UUID(),
        mediaID: UUID,
        sourceStart: Double,
        sourceEnd: Double,
        framing: VideoFraming? = nil,
        framingKeys: [FramingKey]? = nil
    ) {
        self.id = id
        self.mediaID = mediaID
        self.sourceStart = sourceStart
        self.sourceEnd = sourceEnd
        self.framing = framing
        self.framingKeys = framingKeys
    }
}

struct TranscriptWord: Codable, Equatable, Identifiable, Sendable {
    var id: UUID
    var mediaID: UUID
    var text: String
    var start: Double
    var end: Double

    init(
        id: UUID = UUID(),
        mediaID: UUID,
        text: String,
        start: Double,
        end: Double
    ) {
        self.id = id
        self.mediaID = mediaID
        self.text = text
        self.start = start
        self.end = end
    }

    var midpoint: Double { (start + end) / 2 }
}

struct TranscriptSourceRange: Equatable, Sendable {
    var mediaID: UUID
    var start: Double
    var end: Double
}

struct TranscriptWordSelection: Equatable, Sendable {
    enum MarqueeMode: Equatable, Sendable {
        case replace
        case add
        case toggle
    }

    var wordIDs: Set<UUID> = []
    var anchorID: UUID?

    mutating func select(
        _ wordID: UUID,
        orderedWordIDs: [UUID],
        extendingRange: Bool,
        toggling: Bool
    ) {
        if extendingRange,
           let anchorID,
           let anchorIndex = orderedWordIDs.firstIndex(of: anchorID),
           let clickedIndex = orderedWordIDs.firstIndex(of: wordID) {
            let bounds = min(anchorIndex, clickedIndex)...max(anchorIndex, clickedIndex)
            wordIDs = Set(orderedWordIDs[bounds])
            return
        }

        if toggling {
            if wordIDs.contains(wordID) {
                wordIDs.remove(wordID)
            } else {
                wordIDs.insert(wordID)
            }
            anchorID = wordID
            return
        }

        wordIDs = [wordID]
        anchorID = wordID
    }

    mutating func clear() {
        wordIDs.removeAll()
        anchorID = nil
    }

    mutating func selectMarquee(
        _ marquee: CGRect,
        wordFrames: [UUID: CGRect],
        orderedWordIDs: [UUID],
        baseWordIDs: Set<UUID>,
        mode: MarqueeMode
    ) {
        let intersecting = Set(wordFrames.compactMap { wordID, frame in
            marquee.intersects(frame) ? wordID : nil
        })
        switch mode {
        case .replace:
            wordIDs = intersecting
        case .add:
            wordIDs = baseWordIDs.union(intersecting)
        case .toggle:
            wordIDs = baseWordIDs.symmetricDifference(intersecting)
        }
        anchorID = orderedWordIDs.last(where: { wordIDs.contains($0) })
    }

    static func sourceRanges(
        for selectedWordIDs: Set<UUID>,
        in orderedWords: [TranscriptWord],
        padding: Double = 0.025
    ) -> [TranscriptSourceRange] {
        var ranges: [TranscriptSourceRange] = []
        var activeRange: TranscriptSourceRange?

        func padded(_ range: TranscriptSourceRange) -> TranscriptSourceRange {
            TranscriptSourceRange(
                mediaID: range.mediaID,
                start: max(0, range.start - padding),
                end: range.end + padding
            )
        }

        for word in orderedWords {
            guard selectedWordIDs.contains(word.id) else {
                if let activeRange {
                    ranges.append(padded(activeRange))
                }
                activeRange = nil
                continue
            }

            if var current = activeRange, current.mediaID == word.mediaID {
                current.end = max(current.end, word.end)
                activeRange = current
            } else {
                if let activeRange {
                    ranges.append(padded(activeRange))
                }
                activeRange = TranscriptSourceRange(
                    mediaID: word.mediaID,
                    start: word.start,
                    end: word.end
                )
            }
        }

        if let activeRange {
            ranges.append(padded(activeRange))
        }
        return ranges
    }
}

struct ProjectOverlay: Codable, Equatable, Identifiable, Sendable {
    var id: UUID
    var mediaID: UUID
    var timelineStart: Double
    var duration: Double
    var sourceStart: Double
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    /// The part of the media that is shown. `nil` on overlays saved before
    /// cropping, which show all of it.
    var crop: OverlayCrop?
    /// Which lane above the speaker this sits on. 0 is the lane directly above,
    /// and a higher lane draws over a lower one. `nil` reads as 0.
    var track: Int?
    /// Hidden overlays keep their place on the timeline and draw nothing, which
    /// is what the eye on the track rail toggles.
    var isHidden: Bool?
    /// The boxes this cutaway moves through, in seconds from its own start.
    /// `nil` or empty means it holds still. See `OverlayKey`.
    var keys: [OverlayKey]?

    init(
        id: UUID = UUID(),
        mediaID: UUID,
        timelineStart: Double,
        duration: Double,
        sourceStart: Double = 0,
        x: Double = 0.55,
        y: Double = 0.07,
        width: Double = 0.38,
        height: Double = 0.38,
        crop: OverlayCrop? = nil,
        track: Int? = nil,
        isHidden: Bool? = nil,
        keys: [OverlayKey]? = nil
    ) {
        self.id = id
        self.mediaID = mediaID
        self.timelineStart = timelineStart
        self.duration = duration
        self.sourceStart = sourceStart
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.crop = crop
        self.track = track
        self.isHidden = isHidden
        self.keys = keys
    }

    var resolvedCrop: OverlayCrop { crop ?? .full }
    var lane: Int { max(0, track ?? 0) }
    var isVisible: Bool { isHidden != true }
}

/// The three-way look captions and text layers shipped with before colour,
/// stroke, card and shadow became properties of their own. Kept only so saved
/// projects can be read back; see `TextAppearance.fromLegacy(style:font:…)`.
enum TextLayerStyle: String, Codable, CaseIterable, Identifiable, Sendable {
    case plain
    case whiteCard
    case blackCard

    var id: String { rawValue }

    var title: String {
        switch self {
        case .plain: "White text"
        case .whiteCard: "White card"
        case .blackCard: "Black card"
        }
    }
}

enum TextLayerFont: String, Codable, CaseIterable, Identifiable, Sendable {
    case modern
    case rounded
    case editorial

    var id: String { rawValue }

    var title: String {
        switch self {
        case .modern: "Modern"
        case .rounded: "Rounded"
        case .editorial: "Editorial"
        }
    }
}

struct ProjectTextLayer: Equatable, Identifiable, Sendable {
    var id: UUID
    var text: String
    var timelineStart: Double
    var duration: Double
    var x: Double
    var y: Double
    var width: Double
    /// How the words are drawn. The same value type captions use, so both
    /// inspectors offer the same properties.
    var appearance: TextAppearance

    init(
        id: UUID = UUID(),
        text: String,
        timelineStart: Double,
        duration: Double = 4,
        x: Double = 0.5,
        y: Double = 0.18,
        width: Double = 0.74,
        appearance: TextAppearance = .hookDefault
    ) {
        self.id = id
        self.text = text
        self.timelineStart = timelineStart
        self.duration = duration
        self.x = x
        self.y = y
        self.width = width
        self.appearance = appearance
    }

    /// Reached for often enough by the canvas and the timeline to be worth
    /// spelling short.
    var fontScale: Double {
        get { appearance.fontScale }
        set { appearance.fontScale = newValue }
    }

    var displayText: String { appearance.displayText(text) }

    func isVisible(at time: Double) -> Bool {
        time >= timelineStart && time <= timelineStart + duration
    }
}

extension ProjectTextLayer: Codable {
    private enum CodingKeys: String, CodingKey {
        case id, text, timelineStart, duration, x, y, width, appearance
    }

    /// Layers saved before the appearance model kept their look in three flat
    /// fields, so they are folded into one here.
    private enum LegacyKeys: String, CodingKey {
        case fontScale, style, font
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        text = try container.decode(String.self, forKey: .text)
        timelineStart = try container.decode(Double.self, forKey: .timelineStart)
        duration = try container.decode(Double.self, forKey: .duration)
        x = try container.decode(Double.self, forKey: .x)
        y = try container.decode(Double.self, forKey: .y)
        width = try container.decode(Double.self, forKey: .width)
        if let stored = try container.decodeIfPresent(TextAppearance.self, forKey: .appearance) {
            appearance = stored
            return
        }
        let legacy = try decoder.container(keyedBy: LegacyKeys.self)
        appearance = TextAppearance.fromLegacy(
            style: try legacy.decodeIfPresent(TextLayerStyle.self, forKey: .style) ?? .whiteCard,
            font: try legacy.decodeIfPresent(TextLayerFont.self, forKey: .font) ?? .rounded,
            fontScale: try legacy.decodeIfPresent(Double.self, forKey: .fontScale) ?? 0.043
        )
    }
}

struct ProjectAudioLayer: Codable, Equatable, Identifiable, Sendable {
    var id: UUID
    var url: URL
    var name: String
    var timelineStart: Double
    var duration: Double
    var sourceStart: Double
    var sourceDuration: Double?
    var volume: Double
    var builtInID: String?

    init(
        id: UUID = UUID(),
        url: URL,
        name: String,
        timelineStart: Double,
        duration: Double,
        sourceStart: Double = 0,
        sourceDuration: Double? = nil,
        volume: Double = 1,
        builtInID: String? = nil
    ) {
        self.id = id
        self.url = url
        self.name = name
        self.timelineStart = timelineStart
        self.duration = duration
        self.sourceStart = sourceStart
        self.sourceDuration = sourceDuration
        self.volume = volume
        self.builtInID = builtInID
    }
}

enum ProjectAspectRatio: String, Codable, CaseIterable, Identifiable, Sendable {
    case source
    case portrait = "9:16"
    case feedPortrait = "4:5"
    case square = "1:1"
    case landscape = "16:9"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .source: "Original"
        default: rawValue
        }
    }

    var hint: String {
        switch self {
        case .source: "Match the recording"
        case .portrait: "Reels, Shorts, TikTok"
        case .feedPortrait: "Instagram feed"
        case .square: "Square"
        case .landscape: "YouTube, landscape"
        }
    }

    var ratio: Double? {
        switch self {
        case .source: nil
        case .portrait: 9 / 16
        case .feedPortrait: 4 / 5
        case .square: 1
        case .landscape: 16 / 9
        }
    }
}

struct EditorProject: Codable, Equatable, Sendable {
    var id: UUID
    var name: String
    var createdAt: Date
    var updatedAt: Date
    var media: [ProjectMedia]
    var clips: [TimelineClip]
    var transcript: [TranscriptWord]?
    var captionsEnabled: Bool?
    /// Editable caption cards. `nil` marks a project saved before captions were
    /// editable, whose cards are derived from the transcript on demand.
    var captions: [ProjectCaption]?
    var captionStyle: TextStyle?
    var captionWordsPerCard: Int?
    var overlays: [ProjectOverlay]?
    var textLayers: [ProjectTextLayer]?
    var audioLayers: [ProjectAudioLayer]?
    var aspectRatio: ProjectAspectRatio?
    /// The speaker's own track, hidden or silenced from the track rail. Both
    /// keep every clip where it is; they only stop it being seen or heard.
    var videoTrackHidden: Bool?
    var videoTrackMuted: Bool?
    /// How loud the speaker's own track plays, as a multiple. `nil` on projects
    /// saved before there was a fader, and that reads as untouched.
    var videoTrackVolume: Double?
    /// The look the whole video is graded with, in the preview and the export
    /// alike. `nil` on projects saved before filters.
    var visualFilter: VisualFilter?

    init(
        id: UUID = UUID(),
        name: String = "Untitled project",
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        media: [ProjectMedia] = [],
        clips: [TimelineClip] = [],
        transcript: [TranscriptWord]? = nil,
        captionsEnabled: Bool? = nil,
        captions: [ProjectCaption]? = nil,
        captionStyle: TextStyle? = nil,
        captionWordsPerCard: Int? = nil,
        overlays: [ProjectOverlay]? = nil,
        textLayers: [ProjectTextLayer]? = nil,
        audioLayers: [ProjectAudioLayer]? = nil,
        aspectRatio: ProjectAspectRatio? = .source,
        videoTrackHidden: Bool? = nil,
        videoTrackMuted: Bool? = nil,
        videoTrackVolume: Double? = nil,
        visualFilter: VisualFilter? = nil
    ) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.media = media
        self.clips = clips
        self.transcript = transcript
        self.captionsEnabled = captionsEnabled
        self.captions = captions
        self.captionStyle = captionStyle
        self.captionWordsPerCard = captionWordsPerCard
        self.overlays = overlays
        self.textLayers = textLayers
        self.audioLayers = audioLayers
        self.aspectRatio = aspectRatio
        self.videoTrackHidden = videoTrackHidden
        self.videoTrackMuted = videoTrackMuted
        self.videoTrackVolume = videoTrackVolume
        self.visualFilter = visualFilter
    }

    var resolvedVisualFilter: VisualFilter { visualFilter ?? .none }

    var isVideoTrackHidden: Bool { videoTrackHidden == true }
    var isVideoTrackMuted: Bool { videoTrackMuted == true }

    /// What the main track actually plays at: the fader, or nothing at all when
    /// it is muted. Muting and a fader at zero sound the same and mean
    /// different things, so both are kept and this is where they meet.
    var resolvedVideoTrackVolume: Double {
        guard !isVideoTrackMuted else { return 0 }
        return AudioLevel.clamped(videoTrackVolume ?? 1)
    }

    var duration: Double {
        clips.reduce(0) { $0 + $1.duration }
    }

    var selectedAspectRatio: ProjectAspectRatio {
        aspectRatio ?? .source
    }

    var resolvedAspectRatio: Double {
        if let ratio = selectedAspectRatio.ratio { return ratio }
        if let firstClip = clips.first,
           let source = media(for: firstClip),
           source.width > 0,
           source.height > 0
        {
            return Double(source.width) / Double(source.height)
        }
        return 9 / 16
    }

    /// Transcript content belonging to media that is currently present on the
    /// main timeline. Media can remain in the bin after its last clip is
    /// deleted so it can be reused instantly, but its old words must not leak
    /// into the active edit.
    var timelineTranscript: [TranscriptWord] {
        let activeMediaIDs = Set(clips.map(\.mediaID))
        return (transcript ?? []).filter { activeMediaIDs.contains($0.mediaID) }
    }

    /// Whether there are any such words, without building the array to find
    /// out. Asking `timelineTranscript.isEmpty` filters every word in the
    /// project and allocates the result, which is a strange amount of work to
    /// do from inside a view body that only wants to know what to call a
    /// button. It stops at the first word it finds.
    var hasTimelineTranscript: Bool {
        guard let transcript, !transcript.isEmpty else { return false }
        let activeMediaIDs = Set(clips.map(\.mediaID))
        return transcript.contains { activeMediaIDs.contains($0.mediaID) }
    }

    func media(for clip: TimelineClip) -> ProjectMedia? {
        media.first { $0.id == clip.mediaID }
    }

    func timelineStart(for clipID: UUID) -> Double? {
        var cursor = 0.0
        for clip in clips {
            if clip.id == clipID { return cursor }
            cursor += clip.duration
        }
        return nil
    }

    /// Replaces every main-track cut that belongs to one imported video with
    /// that video's full source range. The replacement stays where the first
    /// cut was, while unrelated clips and every non-main-track layer remain
    /// untouched.
    @discardableResult
    mutating func resetMainTrack(mediaID: UUID, sourceDuration: Double) -> TimelineClip? {
        guard sourceDuration > 0 else { return nil }
        let replacement = TimelineClip(
            mediaID: mediaID,
            sourceStart: 0,
            sourceEnd: sourceDuration
        )
        var rebuilt: [TimelineClip] = []
        var inserted = false

        for clip in clips {
            guard clip.mediaID == mediaID else {
                rebuilt.append(clip)
                continue
            }
            if !inserted {
                rebuilt.append(replacement)
                inserted = true
            }
        }

        if !inserted {
            rebuilt.append(replacement)
        }
        clips = rebuilt
        updatedAt = Date()
        return replacement
    }

    /// Removes an imported asset and only the project data that references it.
    /// The source URL is intentionally never touched; undo can restore the
    /// entire project entry instantly.
    @discardableResult
    mutating func removeImportedMedia(_ mediaID: UUID) -> Bool {
        guard media.contains(where: { $0.id == mediaID }) else { return false }
        media.removeAll { $0.id == mediaID }
        clips.removeAll { $0.mediaID == mediaID }
        transcript?.removeAll { $0.mediaID == mediaID }
        overlays?.removeAll { $0.mediaID == mediaID }
        updatedAt = Date()
        return true
    }

    @discardableResult
    /// Lifts a clip off the speaker's track and onto an overlay lane.
    ///
    /// - Parameters:
    ///   - start: where to drop it, or nil to leave it where it was playing.
    ///     Taking the clip out shortens the track underneath it, so "where it
    ///     was" is worked out before the removal, not after.
    ///   - lane: which lane to drop it on, or nil for the lowest free one.
    mutating func promoteClipToOverlay(
        _ clipID: UUID,
        start requestedStart: Double? = nil,
        lane requestedLane: Int? = nil
    ) -> ProjectOverlay? {
        guard
            clips.count > 1,
            let clipIndex = clips.firstIndex(where: { $0.id == clipID }),
            let originalStart = timelineStart(for: clipID)
        else { return nil }
        let clip = clips.remove(at: clipIndex)
        // Taking the clip out shortens the track under it, and an overlay past
        // the end of the edit would never be seen. So the drop is pulled back
        // inside what is left rather than being truncated to fit where it was
        // aimed — the footage keeps its length and moves.
        let remaining = duration
        guard remaining > 0 else {
            clips.insert(clip, at: clipIndex)
            return nil
        }
        let placed = min(clip.duration, remaining)
        let start = min(max(0, requestedStart ?? originalStart), remaining - placed)
        let overlay = ProjectOverlay(
            mediaID: clip.mediaID,
            timelineStart: start,
            duration: placed,
            sourceStart: clip.sourceStart,
            x: 0.5,
            y: 0.5,
            width: 1,
            height: 1,
            track: requestedLane ?? OverlayTracks.firstFreeTrack(
                for: (id: UUID(), start: start, duration: placed),
                in: overlays ?? []
            )
        )
        var updatedOverlays = overlays ?? []
        updatedOverlays.append(overlay)
        overlays = updatedOverlays
        updatedAt = Date()
        return overlay
    }

    /// Drops an overlay back onto the speaker's track, as a cut of its own.
    ///
    /// The inverse of lifting one off it. The track is magnetic, so the overlay
    /// takes a place in the running order rather than a time, and everything
    /// after it moves along to make room.
    @discardableResult
    mutating func demoteOverlayToClip(_ overlayID: UUID, insertionIndex: Int) -> TimelineClip? {
        guard
            let overlayIndex = overlays?.firstIndex(where: { $0.id == overlayID }),
            let overlay = overlays?[overlayIndex],
            overlay.duration > 0,
            media.contains(where: { $0.id == overlay.mediaID })
        else { return nil }

        let clip = TimelineClip(
            mediaID: overlay.mediaID,
            sourceStart: overlay.sourceStart,
            sourceEnd: overlay.sourceStart + overlay.duration
        )
        overlays?.remove(at: overlayIndex)
        clips.insert(clip, at: min(max(0, insertionIndex), clips.count))
        updatedAt = Date()
        return clip
    }

    func isWordKept(_ word: TranscriptWord) -> Bool {
        clips.contains {
            $0.mediaID == word.mediaID && word.midpoint >= $0.sourceStart && word.midpoint <= $0.sourceEnd
        }
    }

    func isSourceRangeKept(mediaID: UUID, start: Double, end: Double) -> Bool {
        let midpoint = (start + end) / 2
        return clips.contains {
            $0.mediaID == mediaID && midpoint >= $0.sourceStart && midpoint <= $0.sourceEnd
        }
    }

    func timelineTime(for word: TranscriptWord) -> Double? {
        var cursor = 0.0
        for clip in clips {
            if clip.mediaID == word.mediaID,
               word.midpoint >= clip.sourceStart,
               word.midpoint <= clip.sourceEnd
            {
                return cursor + min(clip.duration, max(0, word.start - clip.sourceStart))
            }
            cursor += clip.duration
        }
        return nil
    }

    func nearestTimelineTime(for word: TranscriptWord) -> Double {
        if let exact = timelineTime(for: word) { return exact }
        var cursor = 0.0
        var previousSameMediaEnd: (source: Double, timeline: Double)?
        var nextSameMediaStart: (source: Double, timeline: Double)?
        for clip in clips {
            if clip.mediaID == word.mediaID {
                if clip.sourceEnd <= word.midpoint {
                    previousSameMediaEnd = (clip.sourceEnd, cursor + clip.duration)
                } else if clip.sourceStart >= word.midpoint, nextSameMediaStart == nil {
                    nextSameMediaStart = (clip.sourceStart, cursor)
                }
            }
            cursor += clip.duration
        }
        switch (previousSameMediaEnd, nextSameMediaStart) {
        case let (previous?, next?):
            return word.midpoint - previous.source <= next.source - word.midpoint
                ? previous.timeline
                : next.timeline
        case let (previous?, nil):
            return previous.timeline
        case let (nil, next?):
            return next.timeline
        default:
            return 0
        }
    }

    func transcriptWord(at timelineTime: Double) -> TranscriptWord? {
        guard let hit = clip(at: timelineTime), clips.indices.contains(hit.index) else { return nil }
        let clip = clips[hit.index]
        let sourceTime = hit.sourceTime
        var nearest: TranscriptWord?
        var nearestDistance = Double.greatestFiniteMagnitude
        for word in transcript ?? [] where word.mediaID == clip.mediaID {
            guard word.midpoint >= clip.sourceStart, word.midpoint <= clip.sourceEnd else { continue }
            if sourceTime >= word.start - 0.025, sourceTime <= word.end + 0.025 {
                return word
            }
            let distance = abs(word.midpoint - sourceTime)
            if distance < nearestDistance {
                nearest = word
                nearestDistance = distance
            }
        }
        return nearestDistance <= 0.16 ? nearest : nil
    }

    mutating func removeSourceRanges(_ ranges: [(Double, Double)], for mediaID: UUID) {
        guard !ranges.isEmpty else { return }
        let merged = Self.merge(ranges)
        clips = clips.flatMap { clip in
            guard clip.mediaID == mediaID else { return [clip] }
            var kept = [(clip.sourceStart, clip.sourceEnd)]
            for cut in merged {
                kept = kept.flatMap { range in
                    guard cut.1 > range.0, cut.0 < range.1 else { return [range] }
                    var pieces: [(Double, Double)] = []
                    if cut.0 > range.0 { pieces.append((range.0, min(cut.0, range.1))) }
                    if cut.1 < range.1 { pieces.append((max(cut.1, range.0), range.1)) }
                    return pieces
                }
            }
            return kept.compactMap { start, end in
                guard end - start >= 0.08 else { return nil }
                return TimelineClip(mediaID: clip.mediaID, sourceStart: start, sourceEnd: end)
            }
        }
        updatedAt = Date()
    }

    mutating func restoreSourceRange(_ range: (Double, Double), for mediaID: UUID) {
        guard range.1 - range.0 >= 0.02 else { return }
        let restored = TimelineClip(mediaID: mediaID, sourceStart: range.0, sourceEnd: range.1)
        let insertionIndex: Int
        if let next = clips.firstIndex(where: {
            $0.mediaID == mediaID && $0.sourceStart >= range.0
        }) {
            insertionIndex = next
        } else if let previous = clips.lastIndex(where: { $0.mediaID == mediaID }) {
            insertionIndex = clips.index(after: previous)
        } else {
            insertionIndex = clips.endIndex
        }
        clips.insert(restored, at: insertionIndex)
        clips = Self.coalescingAdjacentClips(clips)
        updatedAt = Date()
    }

    private static func coalescingAdjacentClips(_ clips: [TimelineClip]) -> [TimelineClip] {
        var result: [TimelineClip] = []
        for clip in clips where clip.duration >= 0.02 {
            guard var previous = result.last,
                  previous.mediaID == clip.mediaID,
                  clip.sourceStart <= previous.sourceEnd + 0.06,
                  clip.sourceEnd >= previous.sourceStart
            else {
                result.append(clip)
                continue
            }
            result.removeLast()
            previous.sourceStart = min(previous.sourceStart, clip.sourceStart)
            previous.sourceEnd = max(previous.sourceEnd, clip.sourceEnd)
            result.append(previous)
        }
        return result
    }

    private static func merge(_ ranges: [(Double, Double)]) -> [(Double, Double)] {
        let sorted = ranges.filter { $0.1 > $0.0 }.sorted { $0.0 < $1.0 }
        guard var current = sorted.first else { return [] }
        var result: [(Double, Double)] = []
        for range in sorted.dropFirst() {
            if range.0 <= current.1 + 0.06 {
                current.1 = max(current.1, range.1)
            } else {
                result.append(current)
                current = range
            }
        }
        result.append(current)
        return result
    }

    func timelineStart(of clipID: UUID) -> Double? {
        var cursor = 0.0
        for clip in clips {
            if clip.id == clipID { return cursor }
            cursor += clip.duration
        }
        return nil
    }

    func clip(at timelineTime: Double) -> (index: Int, sourceTime: Double)? {
        guard !clips.isEmpty else { return nil }
        let clamped = min(max(0, timelineTime), duration)
        var cursor = 0.0
        for (index, clip) in clips.enumerated() {
            let end = cursor + clip.duration
            if clamped <= end || index == clips.count - 1 {
                return (
                    index,
                    min(clip.sourceEnd, clip.sourceStart + max(0, clamped - cursor))
                )
            }
            cursor = end
        }
        return nil
    }

    mutating func split(clipID: UUID, atTimelineTime timelineTime: Double) -> Bool {
        guard
            let index = clips.firstIndex(where: { $0.id == clipID }),
            let timelineStart = timelineStart(of: clipID)
        else { return false }

        let clip = clips[index]
        let sourceTime = clip.sourceStart + timelineTime - timelineStart
        let minimumSide = 1.0 / 30.0
        guard
            sourceTime > clip.sourceStart + minimumSide,
            sourceTime < clip.sourceEnd - minimumSide
        else { return false }

        clips.replaceSubrange(index ... index, with: [
            TimelineClip(
                mediaID: clip.mediaID,
                sourceStart: clip.sourceStart,
                sourceEnd: sourceTime
            ),
            TimelineClip(
                mediaID: clip.mediaID,
                sourceStart: sourceTime,
                sourceEnd: clip.sourceEnd
            ),
        ])
        updatedAt = Date()
        return true
    }

    mutating func delete(clipID: UUID) -> Bool {
        guard let index = clips.firstIndex(where: { $0.id == clipID }) else {
            return false
        }
        clips.remove(at: index)
        updatedAt = Date()
        return true
    }
}
