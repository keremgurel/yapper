import SwiftUI

/// A yapper's edit in order: cut, captions, a hook, export. One row of pills
/// above the transcript, so the words keep the room and the row still says
/// what has been done and what comes next.
struct SimpleEditSteps: View {
    @ObservedObject var session: EditorSession
    /// Opens the pane a finished step is changed in.
    let open: (SimpleRailItem) -> Void

    private enum Step { case cut, captions, hook, export }

    private var summary: TakeCutSummary {
        TakeCutSummary(clips: session.project.clips, media: session.project.media)
    }

    /// A text layer that starts the video is its hook, whichever tool made it.
    private var hasHook: Bool {
        session.project.textLayers?.contains { $0.timelineStart < 0.05 } == true
    }

    private var nextStep: Step {
        if !summary.isCut { return .cut }
        if !session.captionsVisible { return .captions }
        if !hasHook { return .hook }
        return .export
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                cut
                captions
                hook
                EditStepChip(
                    title: "Export",
                    status: nextStep == .export ? .next : .todo,
                    help: "Save the finished video",
                    disabled: session.isBusy
                ) { ImportPanels.saveExport(for: session) }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }

    @ViewBuilder
    private var cut: some View {
        if let stage = session.oneClickEditStage {
            HStack(spacing: 8) {
                ProgressView().controlSize(.small)
                Text("\(stage.title), step \(stage.rawValue + 1) of \(OneClickEditStage.allCases.count)")
                    .font(.studioCaption)
                    .monospacedDigit()
                    .foregroundStyle(Color.studioTextMuted)
                if session.canCancelCurrentOperation, let operation = session.activeOperation?.operation {
                    Button(operation.cancelLabel) { session.cancelCurrentOperation() }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                }
            }
        } else {
            EditStepChip(
                title: summary.isCut
                    ? "Kept \(formatTime(summary.keptDuration)) of \(formatTime(summary.sourceDuration))"
                    : "1-Click Edit",
                status: summary.isCut ? .done : .next,
                help: summary.isCut
                    ? "Run 1-Click Edit again. Undo brings back this edit."
                    : "Transcribes the take, cuts retakes and pauses, keeps the best take of each line and adds captions. Your file is not changed, and Undo brings everything back.",
                disabled: session.isBusy
            ) { Task { await session.runOneClickEdit() } }
        }
    }

    private var captions: some View {
        let available = session.appActions.availability(.captionVisibility, in: session).isAvailable
        return EditStepChip(
            title: session.captionsVisible ? "Captions" : (session.hasCaptions ? "Show captions" : "Add captions"),
            status: session.captionsVisible ? .done : (nextStep == .captions ? .next : .todo),
            help: session.captionsVisible ? "Change how the captions look" : "Make captions from the transcript",
            disabled: session.isBusy || (!session.captionsVisible && !available)
        ) {
            if session.captionsVisible {
                open(.captions)
            } else {
                Task { await session.toggleCaptions() }
            }
        }
    }

    private var hook: some View {
        EditStepChip(
            title: hasHook ? "Hook" : "Add a hook",
            status: hasHook ? .done : (nextStep == .hook ? .next : .todo),
            help: hasHook ? "Change the hook's words and look" : "Put a line of text over the first seconds",
            disabled: session.isBusy || session.duration <= 0
        ) {
            if !hasHook { session.addTextLayer(asHook: true) }
            open(.text)
        }
    }
}
