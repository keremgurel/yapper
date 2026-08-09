import AppKit
import Foundation

/// Hearing a saved sound without putting it in a project.
///
/// Its own object rather than the editor's preview, because the library page
/// has no project open behind it and a ten minute music bed started there has
/// to be stoppable from there. One sound at a time, always: a library where
/// two previews overlap is a library nobody can audition.
@MainActor
final class SavedAudioPreview: ObservableObject {
    @Published private(set) var playingID: UUID?

    private var sound: NSSound?
    private var end: Task<Void, Never>?

    func toggle(_ item: SavedAudio, at url: URL) {
        if playingID == item.id {
            stop()
        } else {
            play(item, at: url)
        }
    }

    func play(_ item: SavedAudio, at url: URL) {
        stop()
        // By reference: a music bed does not need to be read into memory to be
        // auditioned.
        guard let sound = NSSound(contentsOf: url, byReference: true) else { return }
        self.sound = sound
        sound.play()
        playingID = item.id
        // So the button offers a play again once the sound is over, rather than
        // a stop for something already silent.
        end = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(Int(item.duration * 1000) + 120))
            guard !Task.isCancelled, let self, playingID == item.id else { return }
            clear()
        }
    }

    func stop() {
        sound?.stop()
        clear()
    }

    private func clear() {
        end?.cancel()
        end = nil
        sound = nil
        playingID = nil
    }
}
