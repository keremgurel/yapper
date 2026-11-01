import Foundation

extension EditorSession {
    /// Puts a sound from the library on the timeline at the playhead, through
    /// the action Chirpy uses.
    ///
    /// Separate from `importAudio` because the library already knows what the
    /// file is called and how long it is: it was probed once, on the way in.
    /// Nothing is copied. The layer points at the library's own copy, so the
    /// same bed used in ten projects is one file on disk.
    func addSavedAudio(_ item: SavedAudio) async {
        guard duration > 0 else { return }
        await performAppAction(SavedAudioAddInput(savedAudioID: item.id, at: .time(currentTime)))
    }
}
