@preconcurrency import AVFoundation
import AppKit
import Foundation

/// Evidence comes from the real export pipeline (including its second caption
/// pass), not AVPlayer's intentionally overlay-free playback composition.
@MainActor
final class TimelineInspectionService {
    struct TimedWord {
        let id: UUID
        let text: String
        let at: Double
        var end: Double
        var payload: [String: Any] { ["text": text, "at": at, "end": end] }
    }
    let url: URL
    let duration: Double
    private let range: ClosedRange<Double>
    private let words: [[String: Any]]
    private let waveform: [[String: Any]]

    private init(url: URL, duration: Double, range: ClosedRange<Double>, words: [[String: Any]], waveform: [[String: Any]]) {
        self.url = url; self.duration = duration; self.words = words; self.waveform = waveform
        self.range = range
    }

    func discard() { try? FileManager.default.removeItem(at: url) }

    /// Inspect just the requested edited interval. Generated scenes and
    /// captions retain their original clocks even in the two-pass renderer.
    static func capture(project: EditorProject, times: [Double]) async throws -> [String: Any] {
        let times = boundedTimes(times, duration: project.duration)
        guard let first = times.first, let last = times.last else {
            throw NativeEditorError.aiFailed("No video range was selected for inspection.")
        }
        let rendered = try await render(project: project, range: max(0, first - 0.1)...min(project.duration, last + 0.1))
        defer { rendered.discard() }
        return try await rendered.inspect(times: times)
    }

    static func overview(project: EditorProject) async throws -> [String: Any] {
        var frames: [[String: Any]] = []
        var waveform: [[String: Any]] = []
        for time in overviewTimes(duration: project.duration) {
            let evidence = try await capture(project: project, times: [time])
            frames += evidence["frames"] as? [[String: Any]] ?? []
            let points = evidence["waveform"] as? [[String: Any]] ?? []
            waveform += stride(from: 0, to: points.count, by: max(1, points.count / 32)).prefix(32).map { points[$0] }
        }
        return ["frames": frames, "words": Array(timelineWords(project: project).prefix(5000)).map(\.payload), "waveform": waveform]
    }

    static func render(project: EditorProject, range requested: ClosedRange<Double>? = nil) async throws -> TimelineInspectionService {
        guard project.duration > 0, project.duration <= 7200 else {
            throw NativeEditorError.aiFailed("Visual inspection supports videos up to two hours.")
        }
        let url = FileManager.default.temporaryDirectory.appending(path: "yapper-inspection-\(UUID().uuidString).mp4")
        let start = max(0, requested?.lowerBound ?? 0)
        let end = min(project.duration, requested?.upperBound ?? project.duration)
        guard start.isFinite, end.isFinite, end > start else { throw NativeEditorError.aiFailed("The inspection range is outside the video.") }
        let range = start...end
        let length = range.upperBound - range.lowerBound
        do {
            // Render an exact edited-timeline window. The exporter retains
            // animation clocks; frame/audio metadata restores this origin.
            try await ExportService.export(project: project, to: url, maximumRenderDimension: 960,
                range: CMTimeRange(start: CompositionBuilder.tick(range.lowerBound), duration: CompositionBuilder.tick(length)))
            let source = WaveformSource(key: UUID().uuidString, url: url, duration: length)
            let service = WaveformService()
            let peaks = try await service.peaks(for: source, targetBins: 256) { _, _ in }
            await service.invalidate(source)
            let waveform: [[String: Any]] = peaks.prefix(256).enumerated().map { index, peak in
                ["at": range.lowerBound + Double(index) * length / Double(max(1, peaks.count)),
                 "db": max(-120, 20 * log10(max(0.000001, Double(peak))))]
            }
            let words = timelineWords(project: project).map(\.payload)
            return .init(url: url, duration: project.duration, range: range, words: words, waveform: waveform)
        } catch {
            try? FileManager.default.removeItem(at: url)
            throw error
        }
    }

    static func timelineWords(project: EditorProject) -> [TimedWord] {
        let byMedia = Dictionary(grouping: project.transcript ?? [], by: \.mediaID)
        var cursor = 0.0
        var result: [TimedWord] = []
        for clip in project.clips {
            for word in byMedia[clip.mediaID] ?? [] where word.playbackAnchor >= clip.sourceStart && word.playbackAnchor < clip.sourceEnd {
                let start = cursor + max(0, clip.timelineOffset(forSource: word.start))
                let end = cursor + min(clip.duration, clip.timelineOffset(forSource: word.end))
                if end > start { result.append(.init(id: word.id, text: word.text, at: start, end: end)) }
            }
            cursor += clip.duration
        }
        result.sort { $0.at < $1.at }
        // Provider word tails can overlap, especially across removed pauses.
        // Never tell the reviewer a cut-away tail is still being spoken.
        for index in result.indices.dropLast() { result[index].end = min(result[index].end, result[index + 1].at) }
        return result
    }

    func inspect(times: [Double]) async throws -> [String: Any] {
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 960, height: 960)
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        var frames: [[String: Any]] = []
        for time in Self.boundedTimes(times, duration: duration) {
            try Task.checkCancellation()
            let localTime = min(max(0, range.upperBound - range.lowerBound - 0.04), max(0, time - range.lowerBound))
            let result = try await generator.image(at: CMTime(seconds: localTime, preferredTimescale: 600))
            guard let jpeg = NSBitmapImageRep(cgImage: result.image).representation(using: .jpeg,
                  properties: [.compressionFactor: 0.65]), jpeg.count <= 225_000 else {
                throw NativeEditorError.aiFailed("A video inspection frame could not be prepared.")
            }
            frames.append(["at": result.actualTime.seconds + range.lowerBound, "jpeg": jpeg.base64EncodedString()])
        }
        guard !frames.isEmpty else { throw NativeEditorError.aiFailed("No video frames could be inspected.") }
        let start = frames.compactMap { $0["at"] as? Double }.min() ?? 0
        let end = frames.compactMap { $0["at"] as? Double }.max() ?? duration
        return ["frames": frames,
                "words": Array(words.filter { ($0["end"] as? Double ?? 0) >= start - 1 && ($0["at"] as? Double ?? 0) <= end + 1 }.prefix(5000)),
                "waveform": waveform.filter { ($0["at"] as? Double ?? 0) >= start - 0.5 && ($0["at"] as? Double ?? 0) <= end + 0.5 }]
    }

    static func overviewTimes(duration: Double) -> [Double] {
        (0..<8).map { duration * (Double($0) + 0.5) / 8 }
    }

    static func boundedTimes(_ times: [Double], duration: Double) -> [Double] {
        guard duration.isFinite, duration > 0 else { return [] }
        var result: [Double] = []
        for time in times where time.isFinite {
            let clamped = min(max(0, duration - 0.04), max(0, time))
            if !result.contains(where: { abs($0 - clamped) < 0.02 }) { result.append(clamped) }
            if result.count == 8 { break }
        }
        return result.sorted()
    }

    static func reviewTimes(overlay: ProjectOverlay, scene: OverlayScene, projectDuration: Double) -> [Double] {
        let start = overlay.timelineStart
        let end = start + overlay.duration
        // Prioritize counter phases: early hold, just before transition,
        // count midpoint, completion. Uniform sampling alone misses a hold.
        let counter = scene.animations.first {
            $0.property == .value && ($0.from == nil || $0.from != $0.to)
        }
        var times = [start + 0.08, end - 0.08]
        if let counter {
            times += [start + counter.start - overlay.sourceStart - 0.04,
                      start + (counter.start + counter.end) / 2 - overlay.sourceStart,
                      start + counter.end - overlay.sourceStart + 0.04]
        }
        times += [start - 0.08, end + 0.08, start + overlay.duration / 2,
                  start + overlay.duration / 4, start + overlay.duration * 0.75]
        return boundedTimes(times, duration: projectDuration)
    }
}
