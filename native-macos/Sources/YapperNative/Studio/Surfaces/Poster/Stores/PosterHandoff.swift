import Foundation

/// The editor's hand-over of a finished cut. `StudioWebCommands.openPoster`
/// bumps a generation; each generation opens its item once, as soon as the
/// item is in the library, and never again after the creator moves on.
///
/// Chirpy hands over the same way, with what it filled in: captions and
/// platforms land in the drafts when the video opens; the suggested time and
/// thumbnail prompt wait for the destination column and the cover studio.
@MainActor
final class PosterHandoff: ObservableObject {
    static let shared = PosterHandoff()

    private var handledGeneration = 0
    private(set) var pendingItemID: String?
    /// Bumps each time Chirpy's fill-in lands, so a video that is already
    /// open takes a new suggested time or prompt too.
    @Published private(set) var revision = 0
    private var pendingPrefill: PosterPrefill?
    private var scheduleTimes: [String: Date] = [:]
    private var thumbnailPrompts: [String: String] = [:]

    /// True when this is a new hand-over to act on.
    func take(generation: Int, itemID: String?) -> Bool {
        guard generation != handledGeneration, let itemID else { return false }
        handledGeneration = generation
        pendingItemID = itemID
        return true
    }

    /// Chirpy's fill-in for the next hand-over of this video.
    func prefill(_ prefill: PosterPrefill) {
        pendingPrefill = prefill
    }

    func openIfReady(in library: PosterLibraryStore, bench: PosterBench, drafts: PosterDraftStore = .shared) {
        guard let pendingItemID, let video = library.videos.first(where: { $0.id == pendingItemID }) else { return }
        self.pendingItemID = nil
        if let prefill = pendingPrefill, prefill.videoID == video.id {
            pendingPrefill = nil
            if let platforms = prefill.platforms { drafts.choose(platforms, for: video) }
            if !prefill.captions.isEmpty {
                drafts.applyGenerated(prefill.captions, to: video.id, titleOnly: false, sourceCaption: "")
            }
            scheduleTimes[video.id] = prefill.scheduleAt
            thumbnailPrompts[video.id] = prefill.thumbnailPrompt
            revision += 1
        }
        bench.active = video
    }

    /// The suggested Schedule time for a video, once.
    func takeScheduleTime(for videoID: String) -> Date? {
        scheduleTimes.removeValue(forKey: videoID)
    }

    /// The thumbnail prompt Chirpy filled in for a video, once.
    func takeThumbnailPrompt(for videoID: String) -> String? {
        thumbnailPrompts.removeValue(forKey: videoID)
    }
}
