import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor VolumeTestProjectStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {}
}

@MainActor
@Suite(.serialized)
struct AudioLibraryVolumesTests {
    private func preferences() -> (UserDefaults, String) {
        let name = "audio-defaults-\(UUID())"
        return (UserDefaults(suiteName: name)!, name)
    }

    @Test func defaultsSurviveRelaunchAndStayIndependent() {
        let (preferences, name) = preferences()
        defer { preferences.removePersistentDomain(forName: name) }
        let first = AudioLibraryVolumes(defaults: preferences)
        let music = UUID().uuidString
        #expect(first.volume(for: "whoosh") == 1)
        first.setVolume(0.24, for: "whoosh")
        first.setVolume(0.12, for: music)
        first.setVolume(0, for: "pop")

        let reopened = AudioLibraryVolumes(defaults: preferences)
        #expect(reopened.volume(for: "whoosh") == 0.24)
        #expect(reopened.volume(for: music) == 0.12)
        #expect(reopened.volume(for: "pop") == 0)
        #expect(reopened.volume(for: "camera-shutter") == 1)
        reopened.setVolume(0.6, for: "cheek-pop")
        #expect(reopened.volume(for: "pop") == 0.6)
    }

    @Test func invalidPreferencesCannotProduceInvalidAudioLevels() {
        let (preferences, name) = preferences()
        defer { preferences.removePersistentDomain(forName: name) }
        preferences.set(["pop": -12.0, "whoosh": 99.0], forKey: AudioLibraryVolumes.key)
        let volumes = AudioLibraryVolumes(defaults: preferences)
        #expect(volumes.volume(for: "pop") == 0)
        #expect(volumes.volume(for: "whoosh") == 1)
        volumes.setVolume(.nan, for: "pop")
        #expect(volumes.volume(for: "pop") == 1)
    }

    @Test func auditionUsesTheDefaultAndUpdatesWhilePlaying() throws {
        let (preferences, name) = preferences()
        defer { preferences.removePersistentDomain(forName: name) }
        let volumes = AudioLibraryVolumes(defaults: preferences)
        let effect = try #require(SoundEffectDescriptor.effect(id: "keyboard-typing"))
        let url = try #require(SoundEffectService.shared.bundledURL(for: effect))
        volumes.setVolume(0.2, for: effect.id)
        let preview = SavedAudioPreview(volumes: volumes)
        defer { preview.stop() }
        preview.play(id: effect.id, at: url, duration: effect.duration)
        #expect(preview.playingVolume == Float(0.2))
        volumes.setVolume(0.5, for: effect.id)
        preview.updateVolume()
        #expect(preview.playingVolume == Float(0.5))
        preview.stop()
        #expect(preview.playingID == nil)
        #expect(preview.playingVolume == nil)
    }

    @Test func newTimelineCopiesUseCurrentDefaultsWithoutChangingEarlierClips() async throws {
        let (preferences, name) = preferences()
        defer { preferences.removePersistentDomain(forName: name) }
        let volumes = AudioLibraryVolumes(defaults: preferences)
        let root = FileManager.default.temporaryDirectory.appending(path: "audio-default-project-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let video = root.appending(path: "clip.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor,
            size: CGSize(width: 160, height: 90), seconds: 4, to: video)
        let session = EditorSession(store: VolumeTestProjectStore(), audioLibraryVolumes: volumes)
        await session.importMedia([video])
        defer { session.player.replaceCurrentItem(with: nil) }
        let effect = try #require(SoundEffectDescriptor.effect(id: "whoosh"))
        volumes.setVolume(0.3, for: effect.id)
        await session.addSoundEffect(effect)
        #expect(session.project.audioLayers?.first?.volume == 0.3)

        volumes.setVolume(0.7, for: effect.id)
        session.addSounds([ResolvedSound(effect: effect, timelineStart: 2)])
        #expect(session.project.audioLayers?.map(\.volume) == [0.3, 0.7])
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        let library = AudioLibraryStore()
        let source = try #require(SoundEffectService.shared.bundledURL(for: effect))
        let imported = try await library.add([source])
        let item = try #require(imported.first)
        await library.setKind(.music, for: item.id)
        volumes.setVolume(0.15, for: item.id.uuidString)
        await session.addSavedAudio(item, from: library)
        #expect(session.project.audioLayers?.last?.volume == 0.15)
        volumes.setVolume(0.45, for: item.id.uuidString)
        await session.addSavedAudio(item, from: library)
        #expect(session.project.audioLayers?.map(\.volume) == [0.3, 0.7, 0.15, 0.45])
        // Project persistence stores levels, not references to mutable defaults.
        let copy = try JSONDecoder().decode(EditorProject.self, from: JSONEncoder().encode(session.project))
        volumes.setVolume(0, for: effect.id)
        #expect(copy.audioLayers?.map(\.volume) == [0.3, 0.7, 0.15, 0.45])
    }
}
