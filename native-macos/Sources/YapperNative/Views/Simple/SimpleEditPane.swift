import SwiftUI

/// The edit itself, in one place: 1-Click Edit and its quick steps, the
/// transcript to cut by its words, and Chirpy beside them for everything
/// else. An empty project starts with the one thing it needs, the take.
struct SimpleEditPane: View {
    @ObservedObject var session: EditorSession
    /// In a narrow pane the transcript and Chirpy take turns under 1-Click Edit.
    @AppStorage("simpleEditShowsChirpy") private var showsChirpy = false

    /// Wider than this, Chirpy gets a full-height column of its own.
    private static let sideBySideWidth: CGFloat = 900

    var body: some View {
        GeometryReader { proxy in
            if proxy.size.width >= Self.sideBySideWidth {
                HStack(spacing: 0) {
                    edit
                    Rectangle().fill(Color.studioLine).frame(width: 1)
                    chirpy.frame(width: min(480, proxy.size.width * 0.42))
                }
            } else {
                VStack(spacing: 0) {
                    quickSteps
                    InspectorSegmentedControl(
                        options: [.init(value: false, label: "Transcript"), .init(value: true, label: "Chirpy")],
                        selection: showsChirpy,
                        onSelect: { showsChirpy = $0 }
                    )
                    .environment(\.inspectorFillsWidth, true)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    if showsChirpy {
                        chirpy
                    } else {
                        transcript
                    }
                }
            }
        }
        // ⌘K in a narrow pane brings Chirpy forward.
        .onChange(of: session.isAssistantOpen) { _, open in if open { showsChirpy = true } }
    }

    private var chirpy: some View {
        ChirpyColumn(session: session, conversation: session.conversation)
    }

    private var edit: some View {
        VStack(spacing: 0) {
            quickSteps
            transcript
        }
    }

    private var quickSteps: some View {
        VStack(spacing: 0) {
            if session.project.clips.isEmpty {
                addTake
                Rectangle().fill(Color.studioLine).frame(height: 1)
            }
            QuickEditWorkbench(session: session)
                .frame(height: 176)
            Rectangle().fill(Color.studioLine).frame(height: 1)
        }
    }

    private var transcript: some View {
        TranscriptWorkbench(session: session, cursor: session.playbackCursor, seekReveal: session.timelineSeekReveal)
    }

    private var addTake: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Add your take").font(.studioBodyStrong)
                Text("Or drop a video on the timeline.").font(.studioCaption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Button {
                ImportPanels.openMedia(for: session)
            } label: {
                StudioGlyphLabel("Import", glyph: .plus)
            }
            .buttonStyle(EditorPrimaryButtonStyle(size: .small))
            .disabled(session.isBusy)
        }
        .padding(16)
    }
}
