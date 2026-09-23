import Foundation

/// Save to library for the take under review: idle, saving, saved, failed.
@MainActor
final class RecorderSaveState: ObservableObject {
    enum Phase: Equatable {
        case idle
        case saving
        case saved(itemID: String)
        case failed(RecorderSaveError)
    }

    @Published private(set) var phase: Phase = .idle
    private var uploader: RecorderTakeUploader?

    var savedItemID: String? {
        if case let .saved(id) = phase { return id }
        return nil
    }

    var isSaving: Bool { phase == .saving }

    func save(_ take: RecorderTake, itemID: String?, title: String?) async {
        if isSaving || savedItemID != nil { return }
        if uploader?.take != take || uploader?.itemID != itemID {
            uploader = RecorderTakeUploader(take: take, itemID: itemID, title: title)
        }
        guard let uploader else { return }
        phase = .saving
        do {
            phase = .saved(itemID: try await uploader.save())
        } catch {
            phase = .failed(RecorderSaveError.from(error))
        }
    }

    /// A new take starts unsaved.
    func reset() {
        phase = .idle
        uploader = nil
    }
}
