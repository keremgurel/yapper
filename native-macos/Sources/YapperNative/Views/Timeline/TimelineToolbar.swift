import SwiftUI

/// The bar above the timeline: what it is, the edits that act at the playhead,
/// and the zoom.
///
/// Three groups on one baseline, divided by hairlines. The action group shows
/// names when they all fit and icons when they do not, never a mix.
struct TimelineToolbar: View {
    @ObservedObject var session: EditorSession
    let viewport: TimelineViewportState
    let layout: TimelineViewportLayout

    static let height: CGFloat = 40

    var body: some View {
        HStack(spacing: 12) {
            title
            divider
            ViewThatFits(in: .horizontal) {
                actions(showsTitles: true)
                actions(showsTitles: false)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            TimelineZoomControl(viewport: viewport, layout: layout)
        }
        .padding(.horizontal, 12)
        .frame(height: Self.height)
        .background(Color.panelBackground)
    }

    private var title: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("Timeline")
                .font(.studioBodyStrong)
            Text(clipCount)
                .font(.studioCaption)
                .foregroundStyle(Color.studioTextMuted)
                .monospacedDigit()
        }
        .lineLimit(1)
        .fixedSize()
    }

    private var clipCount: String {
        let count = session.project.clips.count
        return count == 1 ? "1 clip" : "\(count) clips"
    }

    private var divider: some View {
        Rectangle().fill(Color.studioLine).frame(width: 1, height: 16)
    }

    private func actions(showsTitles: Bool) -> some View {
        HStack(spacing: 2) {
            TimelineActionButton(
                title: "Snap",
                // Two edges meeting on a line. There is no magnet in SF
                // Symbols: the name this used to pass drew nothing, which left
                // an empty tile whenever the toolbar fell back to icons.
                systemImage: "arrow.right.and.line.vertical.and.arrow.left",
                shortcut: "hold Option to bypass",
                help: "Snap to the playhead, edges, seconds, and audio transients",
                showsTitle: showsTitles,
                isOn: session.isTimelineSnappingEnabled
            ) {
                session.toggleTimelineSnapping()
            }
            .accessibilityValue(session.isTimelineSnappingEnabled ? "On" : "Off")
            divider.padding(.horizontal, 6)
            TimelineActionButton(
                title: "Split",
                systemImage: "scissors",
                shortcut: "S",
                help: "Split the selected item at the playhead",
                showsTitle: showsTitles
            ) {
                Task { await session.splitAtPlayhead() }
            }
            .disabled(session.project.clips.isEmpty)
            TimelineActionButton(
                title: "Trim start",
                systemImage: "arrow.right.to.line",
                shortcut: "[",
                help: "Pull the selected item's left edge to the playhead",
                showsTitle: showsTitles
            ) {
                Task { await session.trimTimelineSelection(toPlayhead: .leading) }
            }
            .disabled(!session.hasPlayheadCommandTarget)
            TimelineActionButton(
                title: "Trim end",
                systemImage: "arrow.left.to.line",
                shortcut: "]",
                help: "Pull the selected item's right edge to the playhead",
                showsTitle: showsTitles
            ) {
                Task { await session.trimTimelineSelection(toPlayhead: .trailing) }
            }
            .disabled(!session.hasPlayheadCommandTarget)
            TimelineActionButton(
                title: "Delete",
                systemImage: "trash",
                shortcut: "⌫",
                help: "Delete the selected timeline items",
                showsTitle: showsTitles
            ) {
                Task { await session.deleteTimelineSelection() }
            }
            .disabled(!session.hasTimelineSelection)
            TimelineActionButton(
                title: "Auto-trim",
                systemImage: "waveform",
                shortcut: "⇧⌘T",
                help: "Remove silent gaps in the selected clips, or everywhere when nothing is selected",
                showsTitle: showsTitles
            ) {
                Task {
                    await session.autoTrimSilences(
                        clipIDs: session.selectedClipIDs.isEmpty ? nil : session.selectedClipIDs
                    )
                }
            }
            .disabled(session.project.clips.isEmpty || session.isBusy)
        }
        .fixedSize()
    }
}
