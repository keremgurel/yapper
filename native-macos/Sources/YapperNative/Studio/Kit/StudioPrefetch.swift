import Foundation

/// Loads the data the most visited tabs open on, in the background, as soon
/// as someone is signed in. Every store keeps what it loaded, so the first
/// visit to Home, Ideas or Poster paints at once instead of waiting on the
/// network, and the page's own refresh on arrival is answered by the read
/// cache while it is still fresh.
@MainActor
enum StudioPrefetch {
    static func warm() async {
        async let home: Void = HomeItemsStore.shared.refresh()
        async let ideas: Void = IdeasStore.shared.refresh()
        async let poster: Void = PosterLibraryStore.shared.refresh()
        async let connections: Void = PosterConnectionStore.shared.refresh()
        async let project: Void = BrainProjectStore.shared.refresh()
        _ = await (home, ideas, poster, connections, project)
    }
}
