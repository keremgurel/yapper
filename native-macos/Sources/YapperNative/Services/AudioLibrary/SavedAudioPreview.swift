import AppKit
import Foundation

/// Hearing anything on the library page without putting it in a project.
///
/// Its own object rather than the editor's preview, because the library page
/// has no project open behind it and a ten minute music bed started there has
/// to be stoppable from there. One sound at a time, always: a library where two
/// previews overlap is a library nobody can audition.
///
/// Keyed by a plain string so the shipped effects and the creator's own files
/// share it. They are one library on the page, and a play button that stopped
/// only half of what was playing would say otherwise.
@MainActor
final class SavedAudioPreview: ObservableObject {
    @Published private(set) var playingID: String?

    private var sound: NSSound?
    private var end: Task<Void, Never>?

    func toggle(id: String, at url: URL, duration: Double) {
        if playingID == id {
            stop()
        } else {
            play(id: id, at: url, duration: duration)
        }
    }

    func play(id: String, at url: URL, duration: Double) {
        stop()
        // By reference: a music bed does not need to be read into memory to be
        // auditioned.
        guard let sound = NSSound(contentsOf: url, byReference: true) else { return }
        self.sound = sound
        sound.play()
        playingID = id
        // So the button offers a play again once the sound is over, rather than
        // a stop for something already silent.
        end = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(Int(duration * 1000) + 120))
            guard !Task.isCancelled, let self, playingID == id else { return }
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

extension SavedAudioPreview {
    /// One of the creator's own files.
    func toggle(_ item: SavedAudio, at url: URL) {
        toggle(id: item.id.uuidString, at: url, duration: item.duration)
    }

    func isPlaying(_ item: SavedAudio) -> Bool {
        playingID == item.id.uuidString
    }

    /// One of the shipped effects, which live in the bundle rather than in the
    /// library folder.
    func toggle(_ effect: SoundEffectDescriptor) {
        guard let url = SoundEffectService.shared.bundledURL(for: effect) else { return }
        toggle(id: effect.id, at: url, duration: effect.duration)
    }

    func isPlaying(_ effect: SoundEffectDescriptor) -> Bool {
        playingID == effect.id
    }
}
