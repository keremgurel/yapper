import SwiftUI

/// Every export at a glance, in the top bar on every tab. Click for the list.
///
/// Observes only the job center, so progress ticks redraw this badge and
/// nothing else in the window.
struct ExportJobsIndicator: View {
    @ObservedObject var center: ExportJobCenter
    let onNavigate: (StudioDestination) -> Void
    @State private var isOpen = false

    var body: some View {
        if let summary = ExportJobsSummary(jobs: center.jobs) {
            Button {
                isOpen.toggle()
            } label: {
                ExportJobsBadge(summary: summary)
            }
            .buttonStyle(.studioPlain)
            .clickableCursor()
            .help("Show exports")
            .accessibilityLabel(summary.label)
            .popover(isPresented: $isOpen, arrowEdge: .bottom) {
                ExportJobsPopover(center: center) { destination in
                    isOpen = false
                    onNavigate(destination)
                }
            }
        }
    }
}

private struct ExportJobsBadge: View {
    let summary: ExportJobsSummary

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: StudioControlSize.small.cornerRadius, style: .continuous)
        HStack(spacing: 7) {
            ExportProgressRing(tone: summary.tone, fraction: summary.fraction)
            Text(summary.label)
                .font(.system(size: 12, weight: .semibold))
                .monospacedDigit()
                .lineLimit(1)
                .fixedSize()
        }
        .padding(.horizontal, StudioControlSize.small.horizontalPadding)
        .frame(height: StudioControlSize.small.height)
        .background(shape.fill(Color.studioFaintFill))
        .overlay(shape.strokeBorder(Color.studioLine, lineWidth: 1))
        .contentShape(shape)
    }
}
