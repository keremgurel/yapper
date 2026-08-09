import Foundation

/// Holds the caption cue list between project changes.
///
/// `EditorProject.captionCues` builds every card from the transcript, the cuts
/// and the overrides on each call. That is a few milliseconds on a captioned
/// ten minute edit, and the editor asked for it from view bodies: the canvas
/// asked which card is under the playhead, the timeline asked for the whole
/// list twice, the list asked once per row. A single frame paid for it four or
/// five times over, which is what made dragging a card and typing in one crawl.
///
/// The list only depends on the words, the cuts and the cards themselves, so it
/// is rebuilt when one of those changes and read for free the rest of the time.
@MainActor
final class CaptionCueCache {
    /// The inputs `captionCues` is derived from. Comparing arrays that have not
    /// been touched is a pointer comparison, so an unrelated project change
    /// costs nothing to rule out.
    private struct Signature: Equatable {
        let captions: [ProjectCaption]?
        let style: TextStyle?
        let wordsPerCard: Int?
        let clips: [TimelineClip]
        let transcript: [TranscriptWord]?
        let captionsEnabled: Bool?
        let duration: Double

        init(_ project: EditorProject) {
            captions = project.captions
            style = project.captionStyle
            wordsPerCard = project.captionWordsPerCard
            clips = project.clips
            transcript = project.transcript
            captionsEnabled = project.captionsEnabled
            duration = project.duration
        }
    }

    private(set) var cues: [ProjectCaptionCue] = []
    /// What each stored card says right now. The list panel asked the project
    /// for this on every body, which walked the transcript again.
    private(set) var textsByID: [UUID: String] = [:]
    private var signature: Signature?
    private var cuesByID: [UUID: ProjectCaptionCue] = [:]

    /// Rebuilds the list if, and only if, something it is made of changed.
    func refresh(for project: EditorProject) {
        let updated = Signature(project)
        guard updated != signature else { return }
        signature = updated
        cues = project.captionCues
        cuesByID = Dictionary(cues.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        textsByID = project.captionTextsByID
    }

    func cue(_ id: UUID) -> ProjectCaptionCue? { cuesByID[id] }

    func cue(at timelineTime: Double) -> ProjectCaptionCue? {
        cues.first { $0.isVisible(at: timelineTime) }
    }
}
