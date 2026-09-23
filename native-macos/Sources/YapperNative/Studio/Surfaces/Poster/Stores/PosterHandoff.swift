import Foundation

/// The editor's hand-over of a finished cut. `StudioWebCommands.openPoster`
/// bumps a generation; each generation opens its item once, as soon as the
/// item is in the library, and never again after the creator moves on.
@MainActor
final class PosterHandoff: ObservableObject {
    static let shared = PosterHandoff()

    private var handledGeneration = 0
    private(set) var pendingItemID: String?

    /// True when this is a new hand-over to act on.
    func take(generation: Int, itemID: String?) -> Bool {
        guard generation != handledGeneration, let itemID else { return false }
        handledGeneration = generation
        pendingItemID = itemID
        return true
    }

    func openIfReady(in library: PosterLibraryStore, bench: PosterBench) {
        guard let pendingItemID, let video = library.videos.first(where: { $0.id == pendingItemID }) else { return }
        self.pendingItemID = nil
        bench.active = video
    }
}
