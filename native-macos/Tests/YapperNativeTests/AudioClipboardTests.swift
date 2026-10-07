import AppKit
import Testing
@testable import YapperNative

private actor AudioClipboardStore: ProjectPersisting {
    var fails = false
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {
        if fails { throw AppActionError("Test save failure") }
    }
    func failSaves() { fails = true }
}

@MainActor
@Suite(.serialized)
struct AudioClipboardTests {
    private func fixture(store: AudioClipboardStore = AudioClipboardStore()) async throws -> (EditorSession, URL, ProjectAudioLayer) {
        let url = FileManager.default.temporaryDirectory.appending(path: "audio-copy-\(UUID()).mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 4, to: url)
        let session = EditorSession(store: store)
        for _ in 0..<500 { await Task.yield() }
        let effect = try #require(SoundEffectDescriptor.library.first { $0.id == "swoosh" })
        let audioURL = try #require(SoundEffectService.shared.bundledURL(for: effect))
        let layer = ProjectAudioLayer(url: audioURL, name: effect.name, timelineStart: 0,
            duration: 0.4, sourceStart: 0.1, sourceDuration: effect.duration, volume: 0.6,
            builtInID: effect.id, sourceKind: .builtIn, playbackRate: 1.5)
        let media = ProjectMedia(url: url, name: "Take", duration: 4, width: 160, height: 90, hasAudio: false)
        session.updateProject { project in
            project.media = [media]
            project.clips = [TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 4)]
            project.audioLayers = [layer]
        }
        try await session.rebuildComposition(preserveTime: false)
        session.selectAudioLayer(layer.id)
        return (session, url, layer)
    }

    @Test("Copy is a snapshot; repeated pastes preserve settings, use the cursor and undo independently")
    func pasteAndUndo() async throws {
        let (session, url, original) = try await fixture()
        defer { try? FileManager.default.removeItem(at: url) }
        let board = NSPasteboard.withUniqueName()
        defer { board.releaseGlobally() }
        #expect(session.copyTimelineAudio(to: board))
        session.updateProject { $0.audioLayers?[0].volume = 0.2 }
        session.scrub(to: 1.5)
        #expect(await session.pasteTimelineAudio(from: board))
        let first = try #require(session.project.audioLayers?.last)
        var expected = original
        expected.id = first.id
        expected.timelineStart = 1.5
        #expect(first == expected)
        #expect(first.id != original.id)
        #expect(session.timelineSelection == [.audio(first.id)])
        #expect(session.currentTime == 1.5)
        session.scrub(to: 2.5)
        #expect(await session.pasteTimelineAudio(from: board))
        let second = try #require(session.project.audioLayers?.last)
        #expect(second.id != first.id)
        #expect(second.timelineStart == 2.5)
        #expect(session.project.audioLayers?.count == 3)
        await session.undo()
        #expect(session.project.audioLayers?.map(\.id) == [original.id, first.id])
        await session.redo()
        #expect(session.project.audioLayers?.last?.id == second.id)
    }

    @Test("A paste at the end stays within the timeline")
    func endOfTimeline() async throws {
        let (session, url, _) = try await fixture()
        defer { try? FileManager.default.removeItem(at: url) }
        let board = NSPasteboard.withUniqueName()
        defer { board.releaseGlobally() }
        #expect(session.copyTimelineAudio(to: board))
        session.scrub(to: 3.9)
        #expect(await session.pasteTimelineAudio(from: board))
        let copy = try #require(session.project.audioLayers?.last)
        #expect(abs(copy.timelineStart - 3.9) < 0.0001)
        #expect(abs(copy.duration - 0.1) < 0.0001)
    }

    @Test("Text clipboard contents, a different project and non-audio selections are left alone")
    func clipboardScope() async throws {
        let (session, url, original) = try await fixture()
        defer { try? FileManager.default.removeItem(at: url) }
        let board = NSPasteboard.withUniqueName()
        defer { board.releaseGlobally() }
        #expect(session.copyTimelineAudio(to: board))
        session.updateProject { $0.id = UUID() }
        #expect(!session.canPasteTimelineAudio(from: board))
        #expect(!(await session.pasteTimelineAudio(from: board)))
        board.clearContents()
        board.setString("Text to paste", forType: .string)
        #expect(!session.canPasteTimelineAudio(from: board))
        session.setTimelineSelection([])
        #expect(!session.copyTimelineAudio(to: board))
        #expect(board.string(forType: .string) == "Text to paste")
        #expect(session.project.audioLayers == [original])
    }

    @Test("A failed save rolls the paste and selection back")
    func failedPaste() async throws {
        let store = AudioClipboardStore()
        let (session, url, original) = try await fixture(store: store)
        defer { try? FileManager.default.removeItem(at: url) }
        let board = NSPasteboard.withUniqueName()
        defer { board.releaseGlobally() }
        #expect(session.copyTimelineAudio(to: board))
        session.scrub(to: 2)
        await store.failSaves()
        #expect(!(await session.pasteTimelineAudio(from: board)))
        #expect(session.project.audioLayers == [original])
        #expect(session.timelineSelection == [.audio(original.id)])
    }
}
