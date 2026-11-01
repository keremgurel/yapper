import Foundation

/// The saved-audio library as actions. The library page and Chirpy delete a
/// sound through this; it belongs to the account, so it sits outside Undo.
extension AppActionRegistry {
    func registerAudioLibraryActions() {
        registerApp(SavedAudioRemoveInput.self, confirmation: { session, input in
            let item = try session.savedAudio(input.savedAudioID)
            return AppActionConfirmation(title: "Delete “\(item.name)” from your audio library?",
                detail: "The sound file is deleted too. Projects that do not use it are not affected.", confirmLabel: "Delete")
        }) { session, input in
            let item = try session.savedAudio(input.savedAudioID)
            let store = session.audioLibrary
            // An add that is already under way finishes first, so the check
            // below sees the layer it made rather than deleting under it.
            guard await session.beginPreparedTimelineEdit() != nil else {
                throw AppActionError("Wait for the current edit to finish.")
            }
            defer { session.endPreparedTimelineEdit() }
            let removed = await store.remove(item.id) { session.referencesSavedAudio(item, at: store.url(for: item)) }
            guard removed else { throw AppActionError(store.errorMessage ?? "“\(item.name)” could not be deleted.") }
            return AppActionMutation(message: "Deleted “\(item.name)” from your audio library.",
                changes: [.init(targetID: item.id, property: "savedAudio", before: item.name, after: "deleted")])
        }
    }
}

extension EditorSession {
    func savedAudio(_ id: UUID) throws -> SavedAudio {
        guard let item = audioLibrary.items.first(where: { $0.id == id }) else {
            throw AppActionError("That sound is not in your audio library.")
        }
        return item
    }

    /// Deletes a sound from the library, through the action Chirpy uses.
    @discardableResult
    func removeSavedAudio(_ item: SavedAudio) async -> Bool {
        await performAppAction(SavedAudioRemoveInput(savedAudioID: item.id)).status == .applied
    }
}
