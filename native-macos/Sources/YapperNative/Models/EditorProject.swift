import Foundation

struct ProjectMedia: Codable, Equatable, Identifiable, Sendable {
    var id: UUID
    var url: URL
    var name: String
    var duration: Double
    var width: Int
    var height: Int
    var hasAudio: Bool

    init(
        id: UUID = UUID(),
        url: URL,
        name: String,
        duration: Double,
        width: Int,
        height: Int,
        hasAudio: Bool
    ) {
        self.id = id
        self.url = url
        self.name = name
        self.duration = duration
        self.width = width
        self.height = height
        self.hasAudio = hasAudio
    }
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

struct EditorProject: Codable, Equatable, Sendable {
    var id: UUID
    var name: String
    var createdAt: Date
    var updatedAt: Date
    var media: [ProjectMedia]
    var clips: [TimelineClip]

    init(
        id: UUID = UUID(),
        name: String = "Untitled project",
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        media: [ProjectMedia] = [],
        clips: [TimelineClip] = []
    ) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.media = media
        self.clips = clips
    }

    var duration: Double {
        clips.reduce(0) { $0 + $1.duration }
    }

    func media(for clip: TimelineClip) -> ProjectMedia? {
        media.first { $0.id == clip.mediaID }
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
