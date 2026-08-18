import CoreGraphics
import Foundation

enum TimelineSnapKind: String, Sendable {
    case playhead
    case boundary
    case audio
    /// The edges of the caption cards. A captioned edit has hundreds of them,
    /// so they pull only when a drag is nearly exactly on one and they lose
    /// every tie: lining a cutaway up with a spoken line is worth having, and
    /// worth nothing at all if it means the whole track is one long magnet.
    case card
    case second

    var priority: Int {
        switch self {
        case .playhead: 5
        case .boundary: 4
        case .audio: 3
        case .card: 2
        case .second: 1
        }
    }

    var title: String {
        switch self {
        case .playhead: "Playhead"
        case .boundary: "Edge"
        case .audio: "Audio"
        case .card: "Caption"
        case .second: "Second"
        }
    }
}

struct TimelineSnapAnchor: Equatable, Sendable {
    let time: Double
    let kind: TimelineSnapKind
}

struct TimelineSnapMatch: Equatable, Sendable {
    let time: Double
    let kind: TimelineSnapKind
    let distancePixels: Double
}

enum TimelineTrimGeometry {
    static func timeDelta(
        for translationX: CGFloat,
        contentWidth: Double,
        projectDuration: Double
    ) -> Double {
        guard contentWidth > 0, projectDuration > 0 else { return 0 }
        return Double(translationX) * projectDuration / contentWidth
    }

    static func x(
        for time: Double,
        contentWidth: Double,
        projectDuration: Double
    ) -> CGFloat {
        guard contentWidth > 0, projectDuration > 0 else { return 0 }
        return CGFloat(time / projectDuration * contentWidth)
    }
}

enum TimelineSnapEngine {
    static let thresholdPixels = 9.0

    static func match(
        proposedTime: Double,
        anchors: [TimelineSnapAnchor],
        contentWidth: Double,
        projectDuration: Double,
        thresholdPixels: Double = thresholdPixels
    ) -> TimelineSnapMatch? {
        guard contentWidth > 0, projectDuration > 0 else { return nil }
        return anchors.compactMap { anchor -> TimelineSnapMatch? in
            let distance = abs(anchor.time - proposedTime) / projectDuration * contentWidth
            let targetThreshold: Double = switch anchor.kind {
            case .playhead, .boundary: thresholdPixels
            case .audio: min(7, thresholdPixels)
            case .card: min(5, thresholdPixels)
            case .second: min(4, thresholdPixels)
            }
            guard distance <= targetThreshold else { return nil }
            return TimelineSnapMatch(time: anchor.time, kind: anchor.kind, distancePixels: distance)
        }
        .min {
            if abs($0.distancePixels - $1.distancePixels) <= 3,
               $0.kind.priority != $1.kind.priority {
                return $0.kind.priority > $1.kind.priority
            }
            return $0.distancePixels < $1.distancePixels
        }
    }

    static func movingMatch(
        start: Double,
        duration: Double,
        anchors: [TimelineSnapAnchor],
        contentWidth: Double,
        projectDuration: Double
    ) -> (start: Double, match: TimelineSnapMatch)? {
        let startMatch = match(
            proposedTime: start,
            anchors: anchors,
            contentWidth: contentWidth,
            projectDuration: projectDuration
        )
        let endMatch = match(
            proposedTime: start + duration,
            anchors: anchors,
            contentWidth: contentWidth,
            projectDuration: projectDuration
        )
        switch (startMatch, endMatch) {
        case let (startMatch?, endMatch?):
            if startMatch.distancePixels <= endMatch.distancePixels {
                return (startMatch.time, startMatch)
            }
            return (endMatch.time - duration, endMatch)
        case let (startMatch?, nil):
            return (startMatch.time, startMatch)
        case let (nil, endMatch?):
            return (endMatch.time - duration, endMatch)
        default:
            return nil
        }
    }
}

enum TimelineSnapDragGeometry {
    static func trimTranslation(
        originalEdgeTime: Double,
        proposedEdgeTime: Double,
        rawTranslationX: CGFloat,
        anchors: [TimelineSnapAnchor],
        contentWidth: Double,
        projectDuration: Double,
        enabled: Bool
    ) -> (translationX: CGFloat, match: TimelineSnapMatch?) {
        guard enabled,
              let match = TimelineSnapEngine.match(
                proposedTime: proposedEdgeTime,
                anchors: anchors,
                contentWidth: contentWidth,
                projectDuration: projectDuration
              )
        else { return (rawTranslationX, nil) }
        return (
            TimelineTrimGeometry.x(
                for: match.time - originalEdgeTime,
                contentWidth: contentWidth,
                projectDuration: projectDuration
            ),
            match
        )
    }

    static func moveTranslation(
        originalStart: Double,
        proposedStart: Double,
        duration: Double,
        rawTranslationX: CGFloat,
        anchors: [TimelineSnapAnchor],
        contentWidth: Double,
        projectDuration: Double,
        enabled: Bool
    ) -> (translationX: CGFloat, match: TimelineSnapMatch?) {
        guard enabled,
              let result = TimelineSnapEngine.movingMatch(
                start: proposedStart,
                duration: duration,
                anchors: anchors,
                contentWidth: contentWidth,
                projectDuration: projectDuration
              )
        else { return (rawTranslationX, nil) }
        return (
            TimelineTrimGeometry.x(
                for: result.start - originalStart,
                contentWidth: contentWidth,
                projectDuration: projectDuration
            ),
            result.match
        )
    }
}

enum TimelineAudioTransientGeometry {
    static func sourceTimes(
        peaks: [Float],
        duration: Double,
        minimumSpacing: Double = 0.28,
        maximumCount: Int = 320
    ) -> [Double] {
        guard peaks.count >= 3, duration > 0 else { return [] }
        let maximum = peaks.max() ?? 0
        guard maximum > 0.01 else { return [] }
        let strong = max(0.08, maximum * 0.54)
        let quiet = max(0.018, maximum * 0.13)
        let binsPerSecond = Double(peaks.count) / duration
        let quietWindow = max(1, Int((binsPerSecond * 0.09).rounded()))
        let minimumBins = max(1, Int((binsPerSecond * minimumSpacing).rounded()))
        var result: [Double] = []
        var lastAccepted = -minimumBins

        for index in 1 ..< peaks.count - 1 where index - lastAccepted >= minimumBins {
            let lower = max(0, index - quietWindow)
            let previousMaximum = peaks[lower ..< index].max() ?? 0
            let onset = peaks[index] >= max(0.055, maximum * 0.28) && previousMaximum <= quiet
            let localPeak = peaks[index] >= strong
                && peaks[index] >= peaks[index - 1]
                && peaks[index] >= peaks[index + 1]
            guard onset || localPeak else { continue }
            result.append(Double(index) / Double(peaks.count) * duration)
            lastAccepted = index
            if result.count >= maximumCount { break }
        }
        return result
    }
}
