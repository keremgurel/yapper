@preconcurrency import AVFoundation
import Foundation

/// One AVFoundation pass mapped onto its share of the whole export.
///
/// A caption export renders twice: the custom compositor first, then the
/// Core Animation burn-in over that picture. Each pass reports 0 to 1 on its
/// own; the creator should see one bar that only moves forward.
struct ExportPassProgress: Sendable {
    /// The first pass does the compositing work (mattes, framing, filters) and
    /// takes most of the time. The burn-in is a plain re-encode.
    static let compositedShare = 0.75

    let span: ClosedRange<Double>
    let forward: ExportProgressHandler

    init(span: ClosedRange<Double>, report: @escaping ExportProgressHandler) {
        self.span = span
        forward = report
    }

    func report(_ fraction: Double) {
        let clamped = min(1, max(0, fraction.isFinite ? fraction : 0))
        forward(span.lowerBound + (span.upperBound - span.lowerBound) * clamped)
    }
}

/// Forwards only values above the last one. AVFoundation can still report a
/// pass a beat after it finished, and that must not pull the bar back.
final class MonotonicExportProgress: @unchecked Sendable {
    private let lock = NSLock()
    private var last = -Double.infinity
    private let forward: ExportProgressHandler

    init(_ forward: @escaping ExportProgressHandler) {
        self.forward = forward
    }

    var handler: ExportProgressHandler {
        { [self] value in report(value) }
    }

    func report(_ value: Double) {
        lock.withLock {
            guard value > last else { return }
            last = value
            forward(value)
        }
    }
}

/// Reads an export session's progress while it runs.
enum ExportSessionProgress {
    private static let interval: TimeInterval = 0.25

    static func watch(_ session: AVAssetExportSession, pass: ExportPassProgress) -> Task<Void, Never> {
        let reader = SessionReader(session)
        return Task.detached(priority: .utility) {
            if #available(macOS 15, *) {
                for await state in reader.session.states(updateInterval: interval) {
                    if Task.isCancelled { return }
                    if case let .exporting(progress) = state {
                        pass.report(progress.fractionCompleted)
                    }
                }
            } else {
                while !Task.isCancelled {
                    pass.report(Double(reader.session.progress))
                    try? await Task.sleep(for: .seconds(interval))
                }
            }
        }
    }

    /// The session is only read from here, never configured, so handing it to
    /// the watching task is safe even though AVFoundation does not say so.
    private final class SessionReader: @unchecked Sendable {
        let session: AVAssetExportSession
        init(_ session: AVAssetExportSession) { self.session = session }
    }
}
