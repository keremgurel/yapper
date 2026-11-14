import Foundation

/// What the top bar says about all the exports at once.
struct ExportJobsSummary: Equatable {
    enum Tone: Equatable {
        case running
        case done
        case failed
    }

    let tone: Tone
    let label: String
    let fraction: Double

    /// `nil` when there is nothing to show.
    init?(jobs: [ExportJob]) {
        let running = jobs.filter(\.state.isRunning)
        if let only = running.first, running.count == 1 {
            tone = .running
            fraction = only.state.fraction
            label = switch only.state {
            case .preparing: "Preparing export"
            case .posting: "Sending to Poster"
            default: "Exporting \(ExportJobCopy.percent(fraction))"
            }
        } else if !running.isEmpty {
            tone = .running
            fraction = running.map(\.state.fraction).reduce(0, +) / Double(running.count)
            label = "\(running.count) exports · \(ExportJobCopy.percent(fraction))"
        } else if jobs.contains(where: { if case .failed = $0.state { true } else { false } }) {
            tone = .failed
            fraction = 0
            label = "Export failed"
        } else if !jobs.isEmpty {
            tone = .done
            fraction = 1
            label = jobs.count == 1 ? "Exported" : "\(jobs.count) exported"
        } else {
            return nil
        }
    }
}
