import Foundation
import Testing
@testable import YapperNative

/// The library is a folder the creator builds up over months, so what is tested
/// here is mostly what must never happen to it: a file silently overwriting
/// another, the same sound arriving twice, an entry outliving its file without
/// saying so.
@Suite(.serialized)
@MainActor
struct AudioLibraryTests {
    /// Every test writes to the real store, which under test is a per-process
    /// temp directory (`ProjectStore.isTesting`). Cleared between tests so one
    /// import cannot be read by the next.
    private func freshStore() -> AudioLibraryStore {
        try? FileManager.default.removeItem(at: AudioLibraryFolder.directory)
        return AudioLibraryStore()
    }

    /// A real, decodable audio file, because the importer probes duration and a
    /// handful of random bytes has none.
    private func sampleAudio(named name: String) throws -> URL {
        let bundled = try #require(
            Bundle.module.url(forResource: "pop", withExtension: "m4a", subdirectory: "SoundEffects"),
            "the shipped sound effects are the only real audio a test can lean on"
        )
        let copy = FileManager.default.temporaryDirectory.appending(path: name)
        try? FileManager.default.removeItem(at: copy)
        try FileManager.default.copyItem(at: bundled, to: copy)
        return copy
    }

    @Test("An imported file is copied into the library and probed")
    func importsAndCopies() async throws {
        let store = freshStore()
        let source = try sampleAudio(named: "imported-pop.m4a")

        let added = await store.add([source])

        let item = try #require(added.first)
        #expect(store.items.count == 1)
        #expect(item.duration > 0)
        #expect(FileManager.default.fileExists(atPath: store.url(for: item).path))
        // The file the creator imported from is never moved or touched.
        #expect(FileManager.default.fileExists(atPath: source.path))
    }

    @Test("The same file imported twice is saved once")
    func dedupesByContent() async throws {
        let store = freshStore()
        let source = try sampleAudio(named: "twice.m4a")

        await store.add([source])
        let second = await store.add([source])

        #expect(second.isEmpty)
        #expect(store.items.count == 1)
    }

    @Test("Two different files with the same name both survive")
    func keepsBothOfAName() async throws {
        let store = freshStore()
        let first = try sampleAudio(named: "clash.m4a")
        // Different bytes, same name, which is what makes it a real collision
        // rather than a re-import.
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "clash-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let second = directory.appending(path: "clash.m4a")
        var bytes = try Data(contentsOf: first)
        bytes.append(contentsOf: [0x00, 0x01, 0x02])
        try bytes.write(to: second)

        await store.add([first, second])

        #expect(store.items.count == 2)
        let names = Set(store.items.map(\.fileName))
        #expect(names.count == 2, "one copy must not overwrite the other")
        for item in store.items {
            #expect(FileManager.default.fileExists(atPath: store.url(for: item).path))
        }
    }

    @Test("The library survives a relaunch")
    func persists() async throws {
        let store = freshStore()
        await store.add([try sampleAudio(named: "persisted.m4a")])
        let saved = try #require(store.items.first)
        store.rename(saved.id, to: "Intro bed")
        store.setKind(.music, for: saved.id)

        let reopened = AudioLibraryStore()

        let item = try #require(reopened.items.first)
        #expect(reopened.items.count == 1)
        #expect(item.name == "Intro bed")
        #expect(item.kind == .music)
    }

    @Test("Deleting takes the copy with it, and nothing else")
    func deletes() async throws {
        let store = freshStore()
        let source = try sampleAudio(named: "deleted.m4a")
        await store.add([source])
        let item = try #require(store.items.first)
        let copy = store.url(for: item)

        store.remove(item.id)

        #expect(store.items.isEmpty)
        #expect(!FileManager.default.fileExists(atPath: copy.path))
        #expect(FileManager.default.fileExists(atPath: source.path), "the original is not ours")
    }

    @Test("A saved sound whose file is gone is reported, not dropped")
    func reportsMissingFiles() async throws {
        let store = freshStore()
        await store.add([try sampleAudio(named: "vanishing.m4a")])
        let item = try #require(store.items.first)
        try FileManager.default.removeItem(at: store.url(for: item))

        let reopened = AudioLibraryStore()

        #expect(reopened.items.count == 1, "the entry is the creator's to delete")
        #expect(reopened.missingIDs.contains(item.id))
    }

    @Test("Shelves are newest first, within a kind")
    func shelvesNewestFirst() async throws {
        let store = freshStore()
        let first = try sampleAudio(named: "older.m4a")
        var bytes = try Data(contentsOf: first)
        bytes.append(0x7f)
        let second = FileManager.default.temporaryDirectory.appending(path: "newer.m4a")
        try? FileManager.default.removeItem(at: second)
        try bytes.write(to: second)

        await store.add([first])
        await store.add([second])
        for item in store.items { store.setKind(.effect, for: item.id) }

        let shelf = store.items(of: .effect)
        #expect(shelf.count == 2)
        #expect(shelf[0].addedAt >= shelf[1].addedAt)
    }
}

@Suite
struct AudioLibraryNamingTests {
    @Test("A marketplace file name becomes something readable")
    func cleansDownloadedNames() {
        #expect(
            AudioLibraryNaming.displayName(
                for: URL(fileURLWithPath: "/tmp/mixkit-fast-swoosh-1493-[AudioTrimmer].mp3")
            ) == "Mixkit fast swoosh"
        )
        #expect(
            AudioLibraryNaming.displayName(for: URL(fileURLWithPath: "/tmp/my_intro_bed.wav"))
                == "My intro bed"
        )
    }

    @Test("A name with nothing left in it still says something")
    func namesTheUnnameable() {
        #expect(
            AudioLibraryNaming.displayName(for: URL(fileURLWithPath: "/tmp/[].mp3"))
                == "Untitled audio"
        )
    }

    @Test("A taken file name gets a suffix rather than the other file's bytes")
    func avoidsCollisions() {
        let url = URL(fileURLWithPath: "/tmp/pop.mp3")
        #expect(AudioLibraryNaming.uniqueFileName(for: url, taken: []) == "pop.mp3")
        #expect(AudioLibraryNaming.uniqueFileName(for: url, taken: ["pop.mp3"]) == "pop-2.mp3")
        #expect(
            AudioLibraryNaming.uniqueFileName(for: url, taken: ["pop.mp3", "pop-2.mp3"])
                == "pop-3.mp3"
        )
    }

    @Test("File names are safe for the disk they land on")
    func sanitizesNames() {
        let name = AudioLibraryNaming.uniqueFileName(
            for: URL(fileURLWithPath: "/tmp/why: not/ this?.mp3"),
            taken: []
        )
        #expect(!name.contains(":"))
        #expect(!name.contains("?"))
        #expect(name.hasSuffix(".mp3"))
    }

    @Test("Long files land on the music shelf, short ones on effects")
    func guessesKind() {
        #expect(SavedAudioKind.guessed(fromDuration: 0.4) == .effect)
        #expect(SavedAudioKind.guessed(fromDuration: 92) == .music)
    }
}
