import Foundation

/// Holds the transcript's reading order between the changes that affect it.
///
/// The words and their pauses only move when the transcript itself changes or
/// when a cut adds or removes footage. Everything else the editor does — typing
/// in a caption, nudging an overlay, playing the timeline — leaves the list
/// exactly as it was, so it is worth keeping rather than sorting again.
@MainActor
final class TranscriptFlowCache {
    private struct Signature: Equatable {
        let transcript: [TranscriptWord]?
        let clips: [TimelineClip]
        let media: [ProjectMedia]

        init(_ project: EditorProject) {
            transcript = project.transcript
            clips = project.clips
            media = project.media
        }
    }

    private(set) var tokens: [TranscriptFlowToken] = []
    private(set) var words: [TranscriptWord] = []
    /// How wide each token draws. Measured once per transcript, not once per
    /// body: the panel re-renders for all sorts of reasons that have nothing to
    /// do with the words, and a drag elsewhere in the editor was paying for a
    /// full pass over every token on every frame.
    private(set) var tokenWidths: [Double] = []
    private var signature: Signature?
    private var wrapped: (width: Double, lines: [TranscriptLine])?

    func refresh(for project: EditorProject) {
        let updated = Signature(project)
        guard updated != signature else { return }
        signature = updated
        words = project.timelineTranscript
        tokens = TranscriptFlow.tokens(words: words, media: project.media)
        tokenWidths = tokens.map(TranscriptFlow.width(of:))
        wrapped = nil
    }

    /// The wrapping for a given width, worked out once and kept until either
    /// the transcript or the width changes.
    func lines(forWidth width: Double) -> [TranscriptLine] {
        if let wrapped, wrapped.width == width { return wrapped.lines }
        let lines = TranscriptLineBreaker.lines(
            widths: tokenWidths,
            spacing: TranscriptFlow.tokenSpacing,
            available: max(1, width - TranscriptFlow.wrapMargin)
        )
        wrapped = (width, lines)
        return lines
    }
}
