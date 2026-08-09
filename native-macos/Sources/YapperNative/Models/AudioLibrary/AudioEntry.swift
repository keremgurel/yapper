import Foundation

/// One sound on the library page, whichever half it came from.
///
/// The page draws a grid, searches, filters and counts, and none of that should
/// have to ask whether a sound is a file the creator imported or one that ships
/// in the bundle. That question matters in exactly two places: what a card can
/// do with it, and where its audio comes from. So it is answered once, here.
struct AudioEntry: Identifiable, Equatable {
    enum Source: Equatable {
        case saved(SavedAudio)
        case bundled(SoundEffectDescriptor)
    }

    /// Unique across both halves: saved items carry a UUID string, shipped
    /// effects their catalogue id.
    let id: String
    let name: String
    /// The line under the name: what it is, in the creator's words or ours.
    let detail: String
    let duration: Double
    let icon: String
    /// The shelf it belongs to, for the headings in the unfiltered view.
    let group: String
    let source: Source

    var isSaved: Bool {
        if case .saved = source { return true }
        return false
    }

    var saved: SavedAudio? {
        if case let .saved(item) = source { return item }
        return nil
    }

    var effect: SoundEffectDescriptor? {
        if case let .bundled(effect) = source { return effect }
        return nil
    }

    init(_ item: SavedAudio) {
        id = item.id.uuidString
        name = item.name
        detail = item.kind.itemTitle
        duration = item.duration
        icon = item.kind.icon
        group = item.kind.title
        source = .saved(item)
    }

    init(_ effect: SoundEffectDescriptor) {
        id = effect.id
        name = effect.name
        detail = effect.detail
        duration = effect.duration
        icon = effect.icon
        group = effect.category.title
        source = .bundled(effect)
    }

    /// Everything on the page, the creator's own first: their two sounds must
    /// never be below nineteen of ours.
    static func all(saved: [SavedAudio]) -> [AudioEntry] {
        saved.sorted { $0.addedAt > $1.addedAt }.map(AudioEntry.init)
            + SoundEffectDescriptor.library.map(AudioEntry.init)
    }
}
