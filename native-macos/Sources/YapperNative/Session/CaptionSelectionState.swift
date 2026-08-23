import Foundation

/// Caption selection publishes on its own narrow channel.
///
/// `EditorSession` is observed by almost every editor surface. Publishing a
/// caption click there rebuilt the timeline, transcript, media bin, transport
/// and player even though only the caption list, inspector and canvas handles
/// can change. Keeping the ids here limits that click to its real consumers.
@MainActor
final class CaptionSelectionState: ObservableObject {
    @Published private(set) var ids: Set<UUID> = []

    func set(_ ids: Set<UUID>) {
        guard self.ids != ids else { return }
        self.ids = ids
    }
}
