import Foundation

/// Templates put in front of the creator to choose from, for one stretch of
/// the video. Saved with Chirpy's reply so the cards can still be tapped
/// after the project is reopened.
struct StyleOffer: Codable, Equatable, Sendable {
    /// The anchors the stretch was asked for with, passed on unchanged when a
    /// card is tapped so the choice lands on the same words even if the
    /// timeline was trimmed in between. Both `nil` means the whole video.
    var at: TimelineAnchorInput?
    var until: TimelineAnchorInput?
    /// The stretch on the timeline when the offer was made, for the label.
    var start: Double
    var end: Double
    var templateIDs: [String]
    /// The template tapped, once one has been.
    var chosen: String?
}
