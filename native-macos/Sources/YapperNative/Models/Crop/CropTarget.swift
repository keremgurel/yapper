import Foundation

/// What a crop is being edited for.
///
/// The rectangle the editor works in is always the same thing: a part of the
/// source picture, in the source's own fractions. Where that rectangle ends up
/// being stored is not: an overlay keeps a crop of its own, and a main-track
/// clip keeps a framing, which is the same information said differently. See
/// `ClipCropConversion`.
enum CropTarget: Hashable, Identifiable, Sendable {
    case overlay(UUID)
    case clip(UUID)
    /// Every clip and overlay using one imported file, edited together. What
    /// the Media tab offers, where there is no one item to point at.
    case media(UUID)

    var id: Self { self }

    /// What the sheet calls itself.
    var title: String {
        switch self {
        case .overlay: "Crop overlay"
        case .clip: "Crop clip"
        case .media: "Crop media"
        }
    }
}
