import Foundation

/// The words for one job, wherever it is shown.
enum ExportJobCopy {
    static func status(_ job: ExportJob) -> String {
        switch job.state {
        case .preparing: "Preparing footage"
        case let .rendering(fraction): "Rendering \(percent(fraction))"
        case let .posting(stage): posting(stage)
        case .finished(.file): "Saved to \(folderName(of: job.destination))"
        case .finished(.poster): "Ready in Poster"
        case let .failed(message): message
        case .canceled: "Canceled"
        }
    }

    static func posting(_ stage: PosterHandoffStage) -> String {
        switch stage {
        case .uploading: "Uploading to Poster"
        case .registering: "Saving in Poster"
        case .transcribing: "Reading the edit for smart copy"
        }
    }

    static func percent(_ fraction: Double) -> String {
        "\(Int((min(1, max(0, fraction)) * 100).rounded(.down)))%"
    }

    static func folderName(of file: URL) -> String {
        FileManager.default.displayName(atPath: file.deletingLastPathComponent().path)
    }
}
