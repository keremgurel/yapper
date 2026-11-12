import SwiftUI

/// 1-Click Edit, the one thing most people open this pane for, as a single
/// band: its name, what it did to this take, and the button that runs it.
///
/// Deliberately short. It shares a pane with the transcript, and a card that
/// explains itself in a paragraph pushes the words people came to edit off
/// the screen. The explanation lives in the button's tooltip.
struct OneClickEditCard: View {
    @ObservedObject var session: EditorSession

    private var summary: TakeCutSummary {
        TakeCutSummary(clips: session.project.clips, media: session.project.media)
    }

    private var hasFootage: Bool { !session.project.clips.isEmpty }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) {
                    words.fixedSize()
                    Spacer(minLength: 12)
                    action
                }
                VStack(alignment: .leading, spacing: 10) {
                    words
                    action
                }
            }
            if hasFootage {
                TakeCutStrip(summary: summary)
            }
        }
        .foregroundStyle(.white)
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .onStage(.edit)
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 7) {
                StudioGlyph(.quickEdit, size: 15)
                Text("1-Click Edit")
                    .font(.studioSectionTitle)
            }
            Text(line)
                .font(.studioCaption)
                .monospacedDigit()
                .foregroundStyle(.white.opacity(0.8))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// What the edit did, the step it is on, or what it will do.
    private var line: String {
        if let stage = session.oneClickEditStage {
            return "\(stage.title), step \(stage.rawValue + 1) of \(OneClickEditStage.allCases.count)"
        }
        guard hasFootage else { return "Cuts retakes and pauses, then adds captions" }
        let source = formatTime(summary.sourceDuration)
        guard summary.isCut else { return "\(source) of footage, nothing cut yet" }
        return "Kept \(formatTime(summary.keptDuration)) of \(source), \(Int((summary.cutShare * 100).rounded()))% cut"
    }

    @ViewBuilder
    private var action: some View {
        if session.oneClickEditStage != nil {
            if session.canCancelCurrentOperation, let operation = session.activeOperation?.operation {
                Button(operation.cancelLabel) { session.cancelCurrentOperation() }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                    .fixedSize()
            }
        } else {
            Button(summary.isCut ? "Run again" : "Run") {
                Task { await session.runOneClickEdit() }
            }
            .buttonStyle(EditorPrimaryButtonStyle(size: .small))
            .fixedSize()
            .disabled(!hasFootage || session.isBusy)
            .help(hasFootage
                ? "Transcribes the take, cuts retakes and pauses, keeps the best take of each line and adds captions. Your file is not changed, and Undo brings everything back."
                : "Import a video first")
        }
    }
}
