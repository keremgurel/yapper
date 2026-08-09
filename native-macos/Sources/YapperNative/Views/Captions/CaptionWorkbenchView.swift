import SwiftUI

/// The Captions tab: a compact toolbar, the styling inspector, and the lines.
///
/// Sections are separated by hairlines rather than stacked in rounded cards.
/// The pane already has a border; nesting more of them costs a lot of vertical
/// space and says nothing.
struct CaptionWorkbenchView: View {
    @ObservedObject var session: EditorSession

    private var isOn: Bool { session.captionsVisible }

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()

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
        }
        .inspectorPane(maxWidth: 620)
    }

    private var toolbar: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(isOn ? Color.yapperOrange : Color.secondary.opacity(0.45))
                .frame(width: 7, height: 7)
            Text(isOn ? "Captions on" : "Captions off")
                .font(.system(size: 12, weight: .semibold))
            if session.hasCaptions {
                Text("\(session.captions.count) cards")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 8)

            if session.hasCaptions {
                Button {
                    Task { await session.toggleCaptions() }
                } label: {
                    Label(
                        isOn ? "Hide" : "Show",
                        systemImage: isOn ? "eye.slash" : "eye"
                    )
                }
                .buttonStyle(EditorGhostButtonStyle(size: .mini))
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
            .buttonStyle(EditorPrimaryButtonStyle(size: .mini))
            .disabled(session.project.clips.isEmpty || session.isAIEditing)
            .help(
                session.hasCaptions
                    ? "Rebuild every card from the transcript. Replaces hand-edited text."
                    : "Build caption cards from the transcript"
            )
        }
        .padding(.horizontal, 12)
        .frame(height: 36)
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
