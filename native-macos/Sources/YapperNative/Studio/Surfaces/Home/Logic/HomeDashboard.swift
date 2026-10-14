import Foundation

/// What Home shows, decided from what has loaded. The same decisions as the
/// web's `studio-dashboard.tsx`: the page reshapes itself around where the
/// creator is, and never decides on a guess while something is still loading.
struct HomeDashboard {
    struct Channels {
        /// Nil while channel history loads.
        let ranked: [HomeRankedVideo]?
        let stats: HomeChannelStats?
        let weeks: [Int]?
        /// Channels whose history failed, named for the numbers card.
        let missing: String
    }

    /// Nil once setup is done or while any answer is unknown.
    let setup: [HomeSetupStep]?
    /// Nil until a channel is connected.
    let channels: Channels?

    init(
        channels loaded: [HomeChannel]?,
        connections: [ConnectionSummary]?,
        connectionsFailed: Bool,
        items: [IdeaItem]?,
        brainStarted: Bool?,
        now: Date
    ) {
        // Every channel failing leaves nothing to rank; partial failures
        // still count what did load.
        let ranked = loaded.map { HomeChannelHealth.allFailed($0) ? [] : HomeRanking.rankVideos($0) }
        let connected = PublishPlatform.allCases.contains {
            HomeRanking.isConnected($0, channels: loaded, connections: connections)
        }

        // Setup only shows when every answer is known: a slow or failed read
        // must never make a set-up creator look new.
        let known = brainStarted != nil && items != nil
            && (connections != nil || loaded != nil) && !connectionsFailed
        let steps = HomeSetupStep.steps(
            brain: brainStarted ?? false,
            channel: connected,
            idea: !(items ?? []).isEmpty
        )
        setup = known && steps.contains { !$0.done } ? steps : nil

        channels = connected
            ? Channels(
                ranked: ranked,
                stats: ranked.map { HomeChannelMath.stats($0, now: now) },
                weeks: ranked.map { HomeChannelMath.weeklyPosts($0, now: now) },
                missing: HomeChannelHealth.names(HomeChannelHealth.failed(loaded))
            )
            : nil
    }

    static func subtitle(hasIdeas: Bool) -> String {
        hasIdeas
            ? "Get a thought down, or pick up where you left off."
            : "Start with an idea. Type it, or press ⌘D and say it."
    }
}
