import SwiftUI

/// The fast path through an edit: 1-Click Edit on top, and under it the three
/// smaller things people reach for straight after.
struct QuickEditWorkbench: View {
    @ObservedObject var session: EditorSession

    private var hasFootage: Bool { !session.project.clips.isEmpty }
    private var hasTranscript: Bool { session.project.hasTimelineTranscript }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                OneClickEditCard(session: session)

                VStack(alignment: .leading, spacing: 0) {
                    Text("Or do one step yourself")
                        .font(.studioLabelStrong)
                        .foregroundStyle(Color.studioTextMuted)
                        .padding(.bottom, 4)
                    QuickEditRow(
                        glyph: .transcript,
                        title: hasTranscript ? "Transcript" : "Transcribe",
                        detail: hasTranscript
                            ? "Listen to the take again and replace the words"
                            : "Turn what you said into words you can cut by",
                        actionTitle: hasTranscript ? "Transcribe again" : "Transcribe",
                        disabled: !hasFootage || session.isBusy
                    ) { session.startTranscription() }
                    separator
                    QuickEditRow(
                        glyph: .captions,
                        title: "Captions",
                        detail: captionDetail,
                        actionTitle: captionActionTitle,
                        disabled: !hasFootage || session.isBusy
                            || !session.appActions.availability(.captionVisibility, in: session).isAvailable
                    ) { Task { await session.toggleCaptions() } }
                    separator
                    QuickEditRow(
                        glyph: .text,
                        title: "Text hook",
                        detail: "A title over the video, starting at the playhead",
                        actionTitle: "Add hook",
                        disabled: !hasFootage || session.isBusy
                    ) { session.addTextLayer(asHook: true) }
                }
            }
            .padding(16)
        }
        .inspectorPane(maxWidth: 620)
    }

    private var separator: some View {
        Rectangle().fill(Color.studioLine).frame(height: 1)
    }

    /// Hidden captions are still there, so the action offers them back rather
    /// than offering to build them again.
    private var captionActionTitle: String {
        if session.captionsVisible { return "Hide" }
        return session.hasCaptions ? "Show" : "Add captions"
    }

    private var captionDetail: String {
        if session.captionsVisible { return "On. Hiding them keeps every card for later." }
        return session.hasCaptions ? "Hidden. Your cards are still here." : "Made from the transcript"
    }
}
