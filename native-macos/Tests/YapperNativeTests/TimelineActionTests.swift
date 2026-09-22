@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor TimelineTestStore: ProjectPersisting {
    var saves = 0
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws { saves += 1 }
}

/// Split, delete, trim, reorder, shift, and transcript cuts: the timeline
/// commands and Chirpy produce the same saved project through one executor.
@MainActor
@Suite(.serialized)
struct TimelineActionTests {
    private func fixture() async throws -> (EditorProject, URL) {
        let root = FileManager.default.temporaryDirectory.appending(path: "timeline-actions-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let url = root.appending(path: "video.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 6, to: url)
        let media = try await MediaProbe.inspect(url: url)
        let words = ["one", "two", "three", "four", "five", "six"].enumerated().map { index, text in
            TranscriptWord(mediaID: media.id, text: text, start: Double(index) + 0.2, end: Double(index) + 0.7)
        }
        let project = EditorProject(media: [media], clips: [
            TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 2),
            TimelineClip(mediaID: media.id, sourceStart: 2, sourceEnd: 4),
            TimelineClip(mediaID: media.id, sourceStart: 4, sourceEnd: 6),
        ], transcript: words, captionsEnabled: true, captions: words.map {
            ProjectCaption(mediaID: media.id, text: $0.text, sourceStart: $0.start, sourceEnd: $0.end, wordIDs: [$0.id])
        }, textLayers: [ProjectTextLayer(text: "Hook", timelineStart: 1, duration: 3)])
        return (project, root)
    }

    private func session(_ project: EditorProject, plan: @escaping @Sendable (String) throws -> ChirpyPlanReply) async -> EditorSession {
        let session = EditorSession(store: TimelineTestStore())
        await Task.yield()
        session.updateProject { $0 = project }
        session.chirpyPlanner = { payload in try plan(payload["messages"]!.list!.last!["content"]!.text!) }
        return session
    }

    nonisolated private static func reply(_ input: some AppActionInput) throws -> ChirpyPlanReply {
        guard case .object(let fields) = try ActionJSON.encoding(input) else { throw AppActionError("bad test input") }
        return .init(message: "Planned", actions: [.init(action: type(of: input).actionID.rawValue, arguments: fields)])
    }

    private func normalized(_ project: EditorProject) -> EditorProject {
        var copy = project; copy.updatedAt = Date(timeIntervalSince1970: 0)
        // Split produces fresh IDs on each side, so compare the shape instead.
        copy.clips = copy.clips.map { var c = $0; c.id = UUID(uuidString: "00000000-0000-0000-0000-000000000000")!; return c }
        copy.textLayers = copy.textLayers?.map { var l = $0; l.id = UUID(uuidString: "00000000-0000-0000-0000-000000000000")!; return l }
        return copy
    }

    private func release(_ sessions: EditorSession...) {
        for session in sessions { session.player.replaceCurrentItem(with: nil) }
    }

    @Test func splitAtPlayheadMatchesChirpySplitAtTheSameAnchor() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let clip = project.clips[1].id, text = project.textLayers![0].id
        let ui = await session(project) { _ in throw AppActionError("unused") }
        let chat = await session(project) { _ in
            try Self.reply(TimelineSplitInput(itemIDs: [clip, text], at: .init(kind: .time, time: 3, phrase: nil, occurrence: nil, eventID: nil, offset: nil)))
        }
        ui.placePlayhead(at: 3)
        ui.setTimelineSelection([.clip(clip), .text(text)])
        await ui.splitAtPlayhead()
        await chat.runAssistant(instruction: "split the second clip and the hook here")
        #expect(ui.project.clips.count == 4 && chat.project.clips.count == 4)
        #expect(ui.project.textLayers?.count == 2 && chat.project.textLayers?.count == 2)
        #expect(normalized(ui.project) == normalized(chat.project))
        let receipt = try #require(chat.appActions.recentResults.last)
        #expect(receipt.status == .applied)
        #expect(Set(receipt.changes.map(\.targetID)) == [clip, text])
        #expect(receipt.changes.allSatisfy { $0.property == "split" && $0.after.hasPrefix("tail ") })
        // The selection moves to the new tails, as the button does.
        #expect(chat.timelineSelection.count == 2)
        await chat.undo()
        #expect(chat.project.clips.count == 3)
        release(ui, chat)
    }

    @Test func deleteAndTrimSkipLockedClipsAndReportThem() async throws {
        var (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        project.clips[0].isLocked = true
        let locked = project.clips[0].id, second = project.clips[1].id, third = project.clips[2].id
        let ui = await session(project) { _ in throw AppActionError("unused") }
        let chat = await session(project) { instruction in
            instruction.contains("trim")
                ? try Self.reply(TimelineTrimInput(itemIDs: [locked, third], edge: .trailing, to: .init(kind: .time, time: 3, phrase: nil, occurrence: nil, eventID: nil, offset: nil)))
                : try Self.reply(TimelineDeleteInput(itemIDs: [locked, second]))
        }
        ui.setTimelineSelection([.clip(locked), .clip(second)])
        #expect(await ui.deleteTimelineSelection())
        await chat.runAssistant(instruction: "delete the first two clips")
        #expect(ui.project.clips.map(\.id) == [locked, third])
        #expect(normalized(ui.project) == normalized(chat.project))
        let deleted = try #require(chat.appActions.recentResults.last)
        #expect(deleted.skippedIDs == [locked])
        #expect(deleted.changes.map(\.targetID) == [second])

        // After the delete the timeline is four seconds long; 3s is inside the third clip.
        ui.placePlayhead(at: 3)
        ui.setTimelineSelection([.clip(locked), .clip(third)])
        await ui.trimTimelineSelection(toPlayhead: .trailing)
        await chat.runAssistant(instruction: "trim the end")
        #expect(normalized(ui.project) == normalized(chat.project))
        let trimmed = try #require(chat.appActions.recentResults.last)
        #expect(trimmed.skippedIDs == [locked])
        #expect(trimmed.changes.map(\.property) == ["sourceEnd"])
        #expect(chat.project.clips[1].sourceEnd == 5)
        #expect(chat.project.clips[0] == project.clips[0])
        release(ui, chat)
    }

    @Test func reorderAndShiftReportPositions() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let ids = project.clips.map(\.id), text = project.textLayers![0].id
        let chat = await session(project) { instruction in
            instruction.contains("hook")
                ? try Self.reply(TimelineShiftInput(itemIDs: [text], deltaSeconds: 1.5))
                : try Self.reply(ClipReorderInput(clipIDs: [ids[2]], insertionIndex: 0))
        }
        await chat.runAssistant(instruction: "move the last clip first")
        #expect(chat.project.clips.map(\.id) == [ids[2], ids[0], ids[1]])
        let reorder = try #require(chat.appActions.recentResults.last)
        #expect(reorder.changes.map { ($0.targetID, $0.before, $0.after) }.map { "\($0.1)>\($0.2)" } == ["2>0", "0>1", "1>2"])
        await chat.runAssistant(instruction: "push the hook later")
        #expect(chat.project.textLayers?[0].timelineStart == 2.5)
        #expect(chat.appActions.recentResults.last?.changes == [.init(targetID: text, property: "timelineStart", before: "1.0", after: "2.5")])
        let refused = await chat.appActions.execute(try chat.actionRequest(TimelineShiftInput(itemIDs: [ids[0]], deltaSeconds: 1)), in: chat)
        #expect(refused.status == .rejected && refused.message.contains("reorder"))
        release(chat)
    }

    @Test func autoTrimScopeKeepsOnlySilencesInsideTheChosenClips() {
        let media = UUID()
        let clips = [TimelineClip(mediaID: media, sourceStart: 2, sourceEnd: 4), TimelineClip(mediaID: media, sourceStart: 6, sourceEnd: 8)]
        let silences = [(0.0, 1.0), (1.5, 2.5), (3.0, 7.0), (7.9, 7.95), (9.0, 10.0)]
        let scoped = EditorSession.silences(silences, within: clips)
        #expect(scoped.map { "\($0.0)-\($0.1)" } == ["2.0-2.5", "3.0-4.0", "6.0-7.0", "7.9-7.95"])
        #expect(EditorSession.silences(silences, within: nil).count == silences.count)
    }

    @Test func transcriptCutsAndRestoresMatchTheTranscriptPanel() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let words = project.transcript!
        let ui = await session(project) { _ in throw AppActionError("unused") }
        let chat = await session(project) { instruction in
            instruction.contains("back")
                ? try Self.reply(TranscriptWordsInput(wordIDs: [words[2].id], kept: true))
                : instruction.contains("pause")
                    ? try Self.reply(TranscriptPauseInput(mediaID: words[0].mediaID, start: 0.7, end: 1.2, kept: false))
                    : try Self.reply(TranscriptWordsInput(wordIDs: [words[2].id, words[3].id], kept: false))
        }
        await ui.deleteTranscriptWords([words[2], words[3]])
        await chat.runAssistant(instruction: "cut three and four")
        #expect(!chat.project.isWordKept(words[2]) && !chat.project.isWordKept(words[3]))
        #expect(normalized(ui.project) == normalized(chat.project))
        let cut = try #require(chat.appActions.recentResults.last)
        #expect(cut.changes.map(\.targetID) == [words[2].id, words[3].id])
        #expect(cut.message.contains("three four"))

        await ui.restoreTranscriptWords([words[2]])
        await chat.runAssistant(instruction: "put three back")
        #expect(chat.project.isWordKept(words[2]) && !chat.project.isWordKept(words[3]))
        #expect(normalized(ui.project) == normalized(chat.project))

        await ui.deleteTranscriptPause(mediaID: words[0].mediaID, start: 0.7, end: 1.2)
        await chat.runAssistant(instruction: "cut that pause")
        #expect(!chat.project.isSourceRangeKept(mediaID: words[0].mediaID, start: 0.7, end: 1.2))
        #expect(normalized(ui.project) == normalized(chat.project))
        #expect(chat.appActions.recentResults.last?.changes.first?.property == "pause 0.70-1.20")
        release(ui, chat)
    }
}
