import AppKit
import SwiftUI

/// One export: which project, where it is going, how far it has got, and
/// what can be done with it now.
struct ExportJobRow: View {
    let job: ExportJob
    let center: ExportJobCenter
    let navigate: (StudioDestination) -> Void

    private var isFailed: Bool {
        if case .failed = job.state { true } else { false }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(job.projectName)
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)
                    Text(job.kind == .poster ? "Export and post" : job.destination.lastPathComponent)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                Spacer(minLength: 8)
                trailingControl
            }

            if job.state.isRunning {
                progressBar
            }

            Text(ExportJobCopy.status(job))
                .font(.system(size: 11, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(isFailed ? Color.studioDanger : Color.secondary)
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)

            ExportJobActions(job: job, navigate: navigate)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
    }

    @ViewBuilder
    private var trailingControl: some View {
        if job.state.isRunning {
            Button("Cancel") { center.cancel(job.id) }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                .help("Stop this export. Nothing is written.")
        } else {
            Button {
                center.dismiss(job.id)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .bold))
            }
            .buttonStyle(EditorGhostButtonStyle(size: .mini))
            .help("Remove from the list")
            .accessibilityLabel("Remove from the list")
        }
    }

    @ViewBuilder
    private var progressBar: some View {
        if job.state == .preparing {
            ProgressView().progressViewStyle(.linear).controlSize(.small)
        } else {
            ExportProgressBar(fraction: job.state.fraction)
        }
    }
}

/// What a finished export offers.
private struct ExportJobActions: View {
    let job: ExportJob
    let navigate: (StudioDestination) -> Void

    var body: some View {
        switch job.state {
        case let .finished(.file(url)):
            HStack(spacing: 6) {
                Button("Reveal in Finder") { NSWorkspace.shared.activateFileViewerSelecting([url]) }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                Button("Continue to Poster") { navigate(.poster) }
                    .buttonStyle(EditorGhostButtonStyle(size: .mini))
            }
        case let .finished(.poster(itemID)):
            Button("Open in Poster") { StudioWebCommands.shared.openPoster(itemID: itemID) }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
        default:
            EmptyView()
        }
    }
}
