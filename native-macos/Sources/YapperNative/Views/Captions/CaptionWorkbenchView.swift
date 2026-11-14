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

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()

            ScrollViewReader { scrollProxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        if session.hasCaptions {
                            CaptionInspectorView(session: session)
                                .padding(.horizontal, 14)
                            Divider()
                            CaptionListView(session: session) { session.seekToTimelineTime($0) }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 12)
                        } else {
                            emptyState
                                .padding(14)
                        }

                        Divider()
                        DictionaryPanel(session: session)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .onChange(of: seekReveal.request) { _, request in
                    guard
                        let request,
                        let captionID = session.captionCueCache.nearestCueID(
                            to: request.timelineTime
                        )
                    else { return }
                    // No animation and no playback observation: one lazy row
                    // jumps into view after the seek finishes.
                    scrollProxy.scrollTo(captionID, anchor: .center)
                }
                .onChange(of: captionSelection.ids) { _, ids in
                    guard ids.count == 1, let captionID = ids.first else { return }
                    // A timeline click already opens this tab. Reveal the exact
                    // selected row once, without observing playback or adding
                    // animation work to scrolling.
                    scrollProxy.scrollTo(captionID, anchor: .center)
                }
            }
        }
        .inspectorPane(maxWidth: 620)
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
            // Green for showing, grey for hidden: a state, not an action.
            Circle()
                .fill(isOn ? Color.studioSuccess : Color.studioTextMuted.opacity(0.5))
                .frame(width: 7, height: 7)
            Text(isOn ? "Captions on" : "Captions off")
                .font(.studioBodyStrong)
            if session.hasCaptions {
                Text("\(CaptionListProjection.visibleCount(in: session.captions, textsByID: session.captionTexts)) cards")
                    .font(.studioCaption)
                    .foregroundStyle(Color.studioTextMuted)
            }
        }
        .lineLimit(1)
    }

    @ViewBuilder
    private var toolbarActions: some View {

            if session.hasCaptions {
                Button {
                    Task { await session.toggleCaptions() }
                } label: {
                    Label(
                        isOn ? "Hide" : "Show",
                        systemImage: isOn ? "eye.slash" : "eye"
                    )
                }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
                .disabled(!session.appActions.availability(.captionVisibility, in: session).isAvailable)
                .help(
                    isOn
                        ? "Hide captions in the preview and the export. Every card is kept."
                        : "Show captions again"
                )
            }

            Button {
                Task { await session.generateCaptions() }
            } label: {
                Label(
                    session.hasCaptions ? "Regenerate" : "Generate",
                    systemImage: "wand.and.stars"
                )
            }
            .buttonStyle(EditorPrimaryButtonStyle(size: .small))
            .disabled(session.project.clips.isEmpty || session.isBusy)
            .help(
                session.hasCaptions
                    ? "Rebuild every card from the transcript while keeping your corrections."
                    : "Build caption cards from the transcript"
            )
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
