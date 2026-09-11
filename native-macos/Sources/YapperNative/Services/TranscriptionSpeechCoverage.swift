@preconcurrency import AVFoundation
@preconcurrency import SoundAnalysis
import Foundation

/// An independent acoustic check. ASR omissions must not masquerade as pauses.
/// The classifier detects speech, not words; passing this check does not certify
/// spelling, proper names, or the editorial choice of take.
enum TranscriptionSpeechCoverage {
    private final class Observer: NSObject, SNResultsObserving {
        var ranges: [[Double]] = []
        var failure: Error?
        var results = 0

        func request(_ request: SNRequest, didProduce result: SNResult) {
            results += 1
            guard let result = result as? SNClassificationResult,
                  (result.classification(forIdentifier: "speech")?.confidence ?? 0) >= 0.6
            else { return }
            // Half-overlapping windows: use their central half so sound in a
            // neighbouring word is not attributed to the middle of a pause.
            let start = result.timeRange.start.seconds + result.timeRange.duration.seconds / 4
            let end = result.timeRange.end.seconds - result.timeRange.duration.seconds / 4
            if let last = ranges.last, start <= last[1] + 0.001 {
                ranges[ranges.count - 1][1] = max(last[1], end)
            } else {
                ranges.append([start, end])
            }
        }

        func request(_ request: SNRequest, didFailWithError error: Error) { failure = error }
    }

    static func measure(url: URL) throws -> [[Double]] {
        try Task.checkCancellation()
        let analyzer = try SNAudioFileAnalyzer(url: url)
        let observer = Observer()
        let request = try SNClassifySoundRequest(classifierIdentifier: .version1)
        request.windowDuration = CMTime(seconds: 0.5, preferredTimescale: 48_000)
        request.overlapFactor = 0.5
        try analyzer.add(request, withObserver: observer)
        analyzer.analyze()
        try Task.checkCancellation()
        if let failure = observer.failure { throw failure }
        guard observer.results > 0 else {
            throw NativeEditorError.aiFailed("Speech coverage could not be checked for this audio. The edit was left unchanged.")
        }
        return observer.ranges
    }
}
