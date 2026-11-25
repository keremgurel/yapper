import SwiftUI

/// The Captions tab: a compact toolbar, the styling inspector, and the lines.
///
/// Sections are separated by hairlines rather than stacked in rounded cards.
/// The pane already has a border; nesting more of them costs a lot of vertical
/// space and says nothing.
struct CaptionWorkbenchView: View {
    @ObservedObject var session: EditorSession
    @ObservedObject private var seekReveal: TimelineSeekRevealState
    @ObservedObject private var captionSelection: CaptionSelectionState

    init(session: EditorSession) {
        self.session = session
        _seekReveal = ObservedObject(wrappedValue: session.timelineSeekReveal)
        _captionSelection = ObservedObject(wrappedValue: session.captionSelection)
    }

    private var isOn: Bool { session.captionsVisible }

    /// Wider than this, styling and the lines sit side by side.
    private static let sideBySideWidth: CGFloat = 820

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            GeometryReader { proxy in
                if session.hasCaptions, proxy.size.width >= Self.sideBySideWidth {
                    HStack(alignment: .top, spacing: 0) {
                        ScrollView {
                            styling.padding(.horizontal, 14)
                        }
                        .frame(width: min(460, proxy.size.width * 0.46))
                        Rectangle().fill(Color.studioLine).frame(width: 1)
                        linesScroll { lines.padding(.horizontal, 14) }
                    }
                } else {
                    linesScroll {
                        VStack(alignment: .leading, spacing: 0) {
                            if session.hasCaptions {
                                styling.padding(.horizontal, 14)
                                Divider()
                            }
                            lines.padding(.horizontal, 14)
                        }
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color.panelBackground)
    }

    private var styling: some View {
        CaptionInspectorView(session: session)
    }

    /// What the captions say, and the words they should always get right.
    private var lines: some View {
        VStack(alignment: .leading, spacing: 0) {
            if session.hasCaptions {
                InspectorFoldSection("Lines", id: "captions.lines") {
                    CaptionListView(session: session) { session.seekToTimelineTime($0) }
                }
            } else {
                emptyState.padding(.vertical, 14)
            }
            Divider()
            InspectorFoldSection("Dictionary", id: "captions.dictionary", summary: "Names and words captions should spell right", openByDefault: false) {
                DictionaryPanel(session: session)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The lines scroll to the caption under a seek or a timeline click.
    private func linesScroll<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        let body = content()
        return ScrollViewReader { scrollProxy in
            ScrollView { body }
                .onChange(of: seekReveal.request) { _, request in
                    guard
                        let request,
                        let captionID = session.captionCueCache.nearestCueID(to: request.timelineTime)
                    else { return }
                    // No animation and no playback observation: one lazy row
                    // jumps into view after the seek finishes.
                    scrollProxy.scrollTo(captionID, anchor: .center)
                }
                .onChange(of: captionSelection.ids) { _, ids in
                    guard ids.count == 1, let captionID = ids.first else { return }
                    scrollProxy.scrollTo(captionID, anchor: .center)
                }
        }
    }

    /// The state of the captions and the two things to do about it. On one
    /// line when it fits; in a narrow pane the buttons drop under the status
    /// instead of cutting "Captions on" down to "Cap…".
    private var toolbar: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) {
                status.fixedSize()
                Spacer(minLength: 8)
                toolbarActions
            }
            VStack(alignment: .leading, spacing: 8) {
                status
                HStack(spacing: 8) { toolbarActions }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
    }

    private var status: some View {
        HStack(spacing: 8) {
            Text("Captions")
                .font(.studioBodyStrong)
            if session.hasCaptions {
                Text("\(CaptionListProjection.visibleCount(in: session.captions, textsByID: session.captionTexts))")
                    .font(.studioCaption)
                    .foregroundStyle(Color.studioTextMuted)
                    .monospacedDigit()
            }
        }
        .lineLimit(1)
    }

    @ViewBuilder
    private var toolbarActions: some View {
        if session.hasCaptions {
            Button {
                Task { await session.generateCaptions() }
            } label: {
                Label("Regenerate", systemImage: "arrow.clockwise")
            }
            .buttonStyle(EditorGhostButtonStyle(size: .small))
            .disabled(session.project.clips.isEmpty || session.isBusy)
            .help("Rebuild every caption from the transcript while keeping your corrections.")
        } else {
            Button {
                Task { await session.generateCaptions() }
            } label: {
                Label("Generate captions", systemImage: "captions.bubble")
            }
            .buttonStyle(EditorPrimaryButtonStyle(size: .small))
            .disabled(session.project.clips.isEmpty || session.isBusy)
            .help("Make captions from the transcript")
        }

        if session.hasCaptions {
            StudioSwitch(isOn: Binding(
                get: { isOn },
                set: { _ in Task { await session.toggleCaptions() } }
            ))
            .disabled(!session.appActions.availability(.captionVisibility, in: session).isAvailable)
            .help(isOn ? "Hide captions in the preview and the export. Every caption is kept." : "Show captions again")
            .accessibilityLabel("Show captions")
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("No captions yet")
                .font(.studioBodyStrong)
            Text("Generate them from the transcript. Cards follow the recording, so later trims re-time them for you, and they are burned into the export.")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: 420, alignment: .leading)
    }
}
