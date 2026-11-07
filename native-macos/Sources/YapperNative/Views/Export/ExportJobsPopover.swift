import SwiftUI

/// The list behind the export badge, newest first.
struct ExportJobsPopover: View {
    private static let visibleLimit = 6

    @ObservedObject var center: ExportJobCenter
    let navigate: (StudioDestination) -> Void

    private var newestFirst: [ExportJob] {
        Array(center.jobs.reversed().prefix(Self.visibleLimit))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Exports")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if center.jobs.contains(where: { !$0.state.isRunning }) {
                    Button("Clear finished") { center.dismissFinished() }
                        .buttonStyle(EditorGhostButtonStyle(size: .mini))
                }
            }
            .padding(.horizontal, 14)
            .frame(height: 38)

            ForEach(newestFirst) { job in
                Rectangle().fill(Color.studioLine).frame(height: 1)
                ExportJobRow(job: job, center: center, navigate: navigate)
            }
        }
        .frame(width: 330)
        .padding(.bottom, 4)
    }
}
