import SwiftUI

/// 1-Click Edit, the one thing most people open this pane for: what it does,
/// what it did to this take, and the button that runs it.
struct OneClickEditCard: View {
    @ObservedObject var session: EditorSession

    private var summary: TakeCutSummary {
        TakeCutSummary(clips: session.project.clips, media: session.project.media)
    }

    private var hasFootage: Bool { !session.project.clips.isEmpty }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 7) {
                    StudioGlyph(.quickEdit, size: 16)
                    Text("1-Click Edit")
                        .font(.studioSectionTitle)
                }
                Text("Cuts your retakes and pauses, keeps the best take of each line and adds captions. Your original file is not changed.")
                    .font(.studioLabel)
                    .foregroundStyle(.white.opacity(0.78))
                    .fixedSize(horizontal: false, vertical: true)
            }

            if hasFootage {
                take
            }

            if let stage = session.oneClickEditStage {
                running(stage)
            } else {
                runButton
            }
        }
        .foregroundStyle(.white)
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .onStage(.edit)
    }

    /// The take as a line, and what the line says in words.
    private var take: some View {
        VStack(alignment: .leading, spacing: 7) {
            TakeCutStrip(summary: summary)
            Text(takeLine)
                .font(.studioCaption)
                .monospacedDigit()
                .foregroundStyle(.white.opacity(0.78))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            Color.black.opacity(0.42),
            in: RoundedRectangle(cornerRadius: StudioRadius.panel, style: .continuous)
        )
    }

    private var takeLine: String {
        let source = formatTime(summary.sourceDuration)
        guard summary.isCut else { return "\(source) of footage, nothing cut yet" }
        return "Kept \(formatTime(summary.keptDuration)) of \(source). \(Int((summary.cutShare * 100).rounded()))% cut."
    }

    private var runButton: some View {
        Button {
            Task { await session.runOneClickEdit() }
        } label: {
            StudioGlyphLabel(summary.isCut ? "Run it again" : "Run 1-Click Edit", glyph: .quickEdit, size: 14)
        }
        .buttonStyle(EditorPrimaryButtonStyle())
        .disabled(!hasFootage || session.isBusy)
        .help(hasFootage
            ? "Transcribe the take, cut retakes and pauses, then add captions. Undo brings everything back."
            : "Import a video first")
    }

    /// The step it is on, how far through, and the way out.
    private func running(_ stage: OneClickEditStage) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("\(stage.title) (\(stage.rawValue + 1) of \(OneClickEditStage.allCases.count))")
                    .font(.studioLabelStrong)
                StageProgressBar(stage: stage, pace: session.oneClickEditPace)
            }
            if session.canCancelCurrentOperation, let operation = session.activeOperation?.operation {
                Button(operation.cancelLabel) { session.cancelCurrentOperation() }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            }
        }
    }
}
