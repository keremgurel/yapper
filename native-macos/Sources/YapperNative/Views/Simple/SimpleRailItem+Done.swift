import Foundation

/// Whether a tab's part of the video is done, for the tick on the rail. Read
/// off the project, so the rail and the edit cannot disagree.
extension SimpleRailItem {
    @MainActor
    func isDone(in session: EditorSession) -> Bool {
        let project = session.project
        switch self {
        case .quick: return TakeCutSummary(clips: project.clips, media: project.media).isCut
        case .captions: return session.captionsVisible
        case .text: return project.textLayers?.isEmpty == false
        case .sounds: return project.audioLayers?.isEmpty == false
        }
    }
}
