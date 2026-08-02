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

    init(
        id: UUID = UUID(),
        url: URL,
        name: String,
        duration: Double,
        width: Int,
        height: Int,
        hasAudio: Bool,
        kind: Kind = .video
    ) {
        self.id = id
        self.url = url
        self.name = name
        self.duration = duration
        self.width = width
        self.height = height
        self.hasAudio = hasAudio
        self.kind = kind
    }

    var isImage: Bool { kind == .image }
}

struct TimelineClip: Codable, Equatable, Identifiable, Sendable {
    var id: UUID
    var mediaID: UUID
    var sourceStart: Double
    var sourceEnd: Double

    var duration: Double { max(0, sourceEnd - sourceStart) }

    init(
        id: UUID = UUID(),
        mediaID: UUID,
        sourceStart: Double,
        sourceEnd: Double
    ) {
        self.id = id
        self.mediaID = mediaID
        self.sourceStart = sourceStart
        self.sourceEnd = sourceEnd
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

    init(
        id: UUID = UUID(),
        mediaID: UUID,
        timelineStart: Double,
        duration: Double,
        sourceStart: Double = 0,
        x: Double = 0.55,
        y: Double = 0.07,
        width: Double = 0.38,
        height: Double = 0.38
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
    }
}

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

struct ProjectTextLayer: Codable, Equatable, Identifiable, Sendable {
    var id: UUID
    var text: String
    var timelineStart: Double
    var duration: Double
    var x: Double
    var y: Double
    var width: Double
    var fontScale: Double
    var style: TextLayerStyle
    var font: TextLayerFont

    init(
        id: UUID = UUID(),
        text: String,
        timelineStart: Double,
        duration: Double = 4,
        x: Double = 0.5,
        y: Double = 0.18,
        width: Double = 0.74,
        fontScale: Double = 0.043,
        style: TextLayerStyle = .whiteCard,
        font: TextLayerFont = .rounded
    ) {
        self.id = id
        self.text = text
        self.timelineStart = timelineStart
        self.duration = duration
        self.x = x
        self.y = y
        self.width = width
        self.fontScale = fontScale
        self.style = style
        self.font = font
    }

    func isVisible(at time: Double) -> Bool {
        time >= timelineStart && time <= timelineStart + duration
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

struct EditorProject: Codable, Equatable, Sendable {
    var id: UUID
    var name: String
    var createdAt: Date
    var updatedAt: Date
    var media: [ProjectMedia]
    var clips: [TimelineClip]
    var transcript: [TranscriptWord]?
    var overlays: [ProjectOverlay]?
    var textLayers: [ProjectTextLayer]?
    var audioLayers: [ProjectAudioLayer]?

    init(
        id: UUID = UUID(),
        name: String = "Untitled project",
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        media: [ProjectMedia] = [],
        clips: [TimelineClip] = [],
        transcript: [TranscriptWord]? = nil,
        overlays: [ProjectOverlay]? = nil,
        textLayers: [ProjectTextLayer]? = nil,
        audioLayers: [ProjectAudioLayer]? = nil
    ) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.media = media
        self.clips = clips
        self.transcript = transcript
        self.overlays = overlays
        self.textLayers = textLayers
        self.audioLayers = audioLayers
    }

    var duration: Double {
        clips.reduce(0) { $0 + $1.duration }
    }

    /// Transcript content belonging to media that is currently present on the
    /// main timeline. Media can remain in the bin after its last clip is
    /// deleted so it can be reused instantly, but its old words must not leak
    /// into the active edit.
    var timelineTranscript: [TranscriptWord] {
        let activeMediaIDs = Set(clips.map(\.mediaID))
        return (transcript ?? []).filter { activeMediaIDs.contains($0.mediaID) }
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

    @discardableResult
    mutating func promoteClipToOverlay(_ clipID: UUID) -> ProjectOverlay? {
        guard
            clips.count > 1,
            let clipIndex = clips.firstIndex(where: { $0.id == clipID }),
            let start = timelineStart(for: clipID)
        else { return nil }
        let clip = clips.remove(at: clipIndex)
        let available = max(0, duration - start)
        guard available > 0 else {
            clips.insert(clip, at: clipIndex)
            return nil
        }
        let overlay = ProjectOverlay(
            mediaID: clip.mediaID,
            timelineStart: start,
            duration: min(clip.duration, available),
            sourceStart: clip.sourceStart,
            x: 0.5,
            y: 0.5,
            width: 1,
            height: 1
        )
        var updatedOverlays = overlays ?? []
        updatedOverlays.append(overlay)
        overlays = updatedOverlays
        updatedAt = Date()
        return overlay
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
