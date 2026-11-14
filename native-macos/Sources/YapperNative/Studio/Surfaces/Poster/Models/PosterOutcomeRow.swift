import Foundation

/// One destination's line in the outcome list: still going out, or what
/// happened there.
struct PosterOutcomeRow: Identifiable, Equatable {
    /// What the right-hand side of the line shows.
    enum Result: Equatable {
        case sending
        case link(title: String, url: URL)
        case status(String)
    }

    let platform: PublishPlatform
    /// Nil while the destination is still going out.
    let outcome: PosterOutcome?

    var id: String { platform.rawValue }
    var isSending: Bool { outcome == nil }
    var isPosted: Bool { outcome?.status == .posted }

    var result: Result {
        guard let outcome else { return .sending }
        if let url = outcome.url { return .link(title: "View post", url: url) }
        if outcome.status == .posted, let profile = outcome.profileURL { return .link(title: "Open profile", url: profile) }
        return .status(outcome.label)
    }

    /// The lines under the destination's name: why it failed, or what is
    /// left for the creator to do.
    var notes: [String] {
        guard let outcome else { return [] }
        var notes: [String] = []
        if let error = outcome.error { notes.append(PosterErrorCopy.publish(error)) }
        if outcome.coverPending {
            notes.append("Adding your cover once YouTube finishes processing the video.")
        }
        if outcome.coverApplied == false {
            notes.append("YouTube didn’t apply the cover. You can add it in YouTube Studio.")
        }
        if outcome.status == .draft {
            notes.append("Open TikTok, go to your inbox and tap \"Your content from Yapper is ready\" to finish posting.")
        }
        if outcome.status == .posted, outcome.url == nil, outcome.profileURL != nil {
            notes.append("It can take a few minutes to appear on your profile.")
        }
        return notes
    }

    /// One row per destination sent from the page, in platform order. A
    /// destination on its way shows as sending even when an earlier attempt
    /// left a result behind.
    static func list(sent: Set<PublishPlatform>, inFlight: Set<PublishPlatform>, outcomes: [PosterOutcome]) -> [PosterOutcomeRow] {
        PublishPlatform.allCases.filter(sent.contains).compactMap { platform in
            if inFlight.contains(platform) { return PosterOutcomeRow(platform: platform, outcome: nil) }
            guard let outcome = outcomes.last(where: { $0.platform == platform }) else { return nil }
            return PosterOutcomeRow(platform: platform, outcome: outcome)
        }
    }
}
