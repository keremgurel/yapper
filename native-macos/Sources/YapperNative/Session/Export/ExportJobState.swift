import Foundation

enum ExportJobState: Equatable, Sendable {
    /// Copying the footage into the export's private snapshot. Until this is
    /// done the export still reads the project's own files.
    case preparing
    /// Rendering, from 0 to 1.
    case rendering(Double)
    /// Rendered; handing the file to Poster.
    case posting(PosterHandoffStage)
    case finished(ExportJob.Result)
    case failed(String)
    case canceled

    var isRunning: Bool {
        switch self {
        case .preparing, .rendering, .posting: true
        case .finished, .failed, .canceled: false
        }
    }

    /// How much of the bar to fill. Posting counts as rendered: the file is
    /// done, only the upload is left.
    var fraction: Double {
        switch self {
        case .preparing, .canceled, .failed: 0
        case let .rendering(fraction): fraction
        case .posting, .finished: 1
        }
    }

    /// A later state, or `nil` when `next` would move the job backwards.
    /// Progress arrives from background threads and can land out of order.
    func advanced(to next: ExportJobState) -> ExportJobState? {
        guard isRunning else { return nil }
        switch (self, next) {
        case let (.rendering(current), .rendering(proposed)):
            return proposed > current ? next : nil
        case (.posting, .preparing), (.posting, .rendering):
            return nil
        case (.rendering, .preparing):
            return nil
        default:
            return next == self ? nil : next
        }
    }
}
