import SwiftUI

/// The fast path through an edit: 1-Click Edit, and under it the three
/// smaller things people reach for straight after.
struct QuickEditWorkbench: View {
    @ObservedObject var session: EditorSession

    private var hasFootage: Bool { !session.project.clips.isEmpty }
    private var hasTranscript: Bool { session.project.hasTimelineTranscript }
    private var isBlocked: Bool { !hasFootage || session.isBusy }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                OneClickEditCard(session: session)
                // Equal tiles: three across under the band when there is
                // room, fewer as the pane narrows.
                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 168), spacing: 8)],
                    alignment: .leading,
                    spacing: 8
                ) {
                    transcribe
                    captions
                    hook
                }
            }
            .padding(16)
        }
        .inspectorPane(maxWidth: 620)
    }

    private var transcribe: some View {
        QuickEditTile(
            glyph: .transcript,
            title: hasTranscript ? "Transcribe again" : "Transcribe",
            state: hasTranscript ? "\(session.transcriptFlowCache.words.count) words now" : "No transcript yet",
            help: hasTranscript
                ? "Listen to the take again and replace the transcript"
                : "Turn what you said into words you can cut by",
            disabled: isBlocked
        ) { session.startTranscription() }
    }

    private var captions: some View {
        QuickEditTile(
            glyph: .captions,
            title: captionTitle,
            state: captionState,
            help: captionHelp,
            disabled: isBlocked || !session.appActions.availability(.captionVisibility, in: session).isAvailable
        ) { Task { await session.toggleCaptions() } }
    }

    private var hook: some View {
        QuickEditTile(
            glyph: .text,
            title: "Add text hook",
            state: "At the playhead",
            help: "Put a title over the video, starting at the playhead",
            disabled: isBlocked
        ) { session.addTextLayer(asHook: true) }
    }

    /// Hidden captions are still there, so the action offers them back rather
    /// than offering to build them again.
    private var captionTitle: String {
        if session.captionsVisible { return "Hide captions" }
        return session.hasCaptions ? "Show captions" : "Add captions"
    }

    private var captionState: String {
        let cards = session.project.storedCaptions.count
        if session.captionsVisible { return "\(cards) cards showing" }
        return session.hasCaptions ? "\(cards) cards hidden" : "None yet"
    }

    private var captionHelp: String {
        if session.captionsVisible { return "Hide the captions. Every card is kept for later." }
        return session.hasCaptions ? "Bring your caption cards back" : "Make captions from the transcript"
    }
}
