import Foundation

/// What a Studio Chirpy turn changed on the server, as the web bridge reports
/// it in the reply's `effects`. Each one reloads the native stores that show
/// that data, but only stores that have loaded already: a tab the creator has
/// not opened reads fresh when it opens.
enum StudioChirpyEffects {
    @MainActor
    static func apply(_ effects: [String]) {
        if effects.contains("ideas") {
            Task {
                if IdeasStore.shared.items != nil { await IdeasStore.shared.refresh() }
                if CalendarStore.shared.items != nil { await CalendarStore.shared.refresh() }
            }
        }
        if effects.contains("ideaViews"), IdeaViewsStore.shared.views != nil {
            Task { await IdeaViewsStore.shared.reload() }
        }
    }
}
