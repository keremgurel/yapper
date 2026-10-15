import Foundation

/// Loads the data the most visited tabs open on, in the background, as soon
/// as someone is signed in. Every store keeps what it loaded, so the first
/// visit to Home, Ideas, Poster, Calendar or Brand paints at once instead of waiting on the
/// network, and the page's own refresh on arrival is answered by the read
/// cache while it is still fresh.
@MainActor
enum StudioPrefetch {
    static func warm() async {
        async let home: Void = HomeChannelsStore.shared.refresh(maxAge: 60)
        async let ideas: Void = IdeasStore.shared.refresh()
        async let poster: Void = PosterLibraryStore.shared.refresh()
        async let connections: Void = PosterConnectionStore.shared.refresh()
        async let project: Void = BrainProjectStore.shared.refresh()
        async let automations: Void = AutomationStore.shared.refresh()
        async let calendar: Void = CalendarStore.shared.refresh()
        async let brand: Void = BrandKitStore.shared.refresh()
        async let saved: Void = HomeTimeSavedStore.shared.refresh()
        _ = await (home, ideas, poster, connections, project, automations, calendar, brand, saved)
    }
}
