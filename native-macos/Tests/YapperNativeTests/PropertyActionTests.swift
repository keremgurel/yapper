@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor PropertyTestStore: ProjectPersisting {
    var saves: [EditorProject] = []
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws { saves.append(project) }
}

/// Property sets: the inspector and Chirpy write the same fields through the
/// same executor, receipts carry before/after values, and bad input never
/// touches the project.
@MainActor
@Suite(.serialized)
struct PropertyActionTests {
    /// Committing with a rebuild, and undoing, both drive the player, so tests
    /// that save use a real (synthetic) video. Rejection tests can stay light.
    private func mediaFixture() async throws -> (EditorProject, URL) {
        let root = FileManager.default.temporaryDirectory.appending(path: "property-actions-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let url = root.appending(path: "video.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 4, to: url)
        let media = try await MediaProbe.inspect(url: url)
        let tone = root.appending(path: "tone.wav")
        try writeTone(to: tone)
        var project = fixture(mediaID: media.id)
        project.media = [media]
        project.audioLayers = [ProjectAudioLayer(url: tone, name: "Click", timelineStart: 1, duration: 0.5)]
        return (project, root)
    }

    private func writeTone(to url: URL) throws {
        let format = try #require(AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1))
        let buffer = try #require(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 48000))
        buffer.frameLength = buffer.frameCapacity
        let samples = try #require(buffer.floatChannelData?[0])
        for index in 0..<Int(buffer.frameLength) {
            samples[index] = Float(0.3 * sin(2 * .pi * 220 * Double(index) / 48000))
        }
        let file = try AVAudioFile(forWriting: url, settings: format.settings)
        try file.write(from: buffer)
    }

    private func fixture(mediaID: UUID = UUID()) -> EditorProject {
        let id = mediaID
        let words = [
            TranscriptWord(mediaID: id, text: "hello", start: 0.2, end: 0.6),
            TranscriptWord(mediaID: id, text: "there", start: 0.8, end: 1.2),
        ]
        return EditorProject(
            clips: [TimelineClip(mediaID: id, sourceStart: 0, sourceEnd: 2), TimelineClip(mediaID: id, sourceStart: 2, sourceEnd: 4, isLocked: true)],
            transcript: words, captionsEnabled: true,
            captions: [
                ProjectCaption(mediaID: id, text: "hello", sourceStart: 0.2, sourceEnd: 0.6, wordIDs: [words[0].id]),
                ProjectCaption(mediaID: id, text: "there", sourceStart: 0.8, sourceEnd: 1.2, wordIDs: [words[1].id]),
            ],
            textLayers: [ProjectTextLayer(text: "Hook", timelineStart: 0)],
            audioLayers: [ProjectAudioLayer(url: URL(fileURLWithPath: "/tmp/click.m4a"), name: "Click", timelineStart: 1, duration: 0.5)]
        )
    }

    /// A planner that returns whatever the test says, so the chat path is
    /// exercised end to end without a provider.
    private func session(_ project: EditorProject, plan: @escaping @Sendable (String) throws -> ChirpyPlanReply) async -> (EditorSession, PropertyTestStore) {
        let store = PropertyTestStore()
        let session = EditorSession(store: store)
        await Task.yield()
        session.updateProject { $0 = project }
        session.chirpyPlanner = { payload in try plan(payload["messages"]!.list!.last!["content"]!.text!) }
        return (session, store)
    }

    nonisolated private static func reply(_ input: some AppActionInput) throws -> ChirpyPlanReply {
        guard case .object(let fields) = try ActionJSON.encoding(input) else { throw AppActionError("bad test input") }
        return .init(message: "Planned", actions: [.init(action: type(of: input).actionID.rawValue, arguments: fields)])
    }

    private func normalized(_ project: EditorProject) -> EditorProject {
        var copy = project; copy.updatedAt = Date(timeIntervalSince1970: 0); return copy
    }

    /// The inspector schedules its action from a synchronous control; wait for
    /// the registry to record the receipt before comparing.
    private func settle(_ session: EditorSession, until count: Int) async {
        for _ in 0..<2000 where session.appActions.recentResults.count < count { await Task.yield() }
    }

    @Test func captionStyleFromInspectorAndChirpySaveEquivalentStateWithReceipts() async throws {
        let (project, root) = try await mediaFixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let (ui, uiStore) = await session(project) { _ in throw AppActionError("unused") }
        let (chat, chatStore) = await session(project) { _ in
            try Self.reply(CaptionStyleInput(captionIDs: [], applyToAll: true,
                style: TextStyleInput(TextStylePatch(fontScale: 0.08, color: StudioColor(hex: "#FF7A21")))))
        }
        ui.captionApplyToAll = true
        ui.setCaptionStyle(TextStylePatch(fontScale: 0.08, color: StudioColor(hex: "#FF7A21")))
        await settle(ui, until: 1)
        await chat.runAssistant(instruction: "make the captions bigger and orange")
        #expect(normalized(ui.project) == normalized(chat.project))
        #expect(ui.project.captionStyleOrDefault.appearance.fontScale == 0.08)
        #expect(ui.project.captionStyleOrDefault.appearance.color == StudioColor(hex: "#FF7A21"))
        let receipt = try #require(chat.appActions.recentResults.last)
        #expect(receipt.status == .applied && receipt.persisted)
        #expect(Set(receipt.changes.map(\.property)) == ["captionStyle.appearance.fontScale", "captionStyle.appearance.color"])
        #expect(receipt.changes.first { $0.property.hasSuffix("fontScale") }?.after == "0.08")
        #expect(await uiStore.saves.map(normalized) == chatStore.saves.map(normalized))
        #expect(chat.conversation.messages.last?.tone == .done)
        await chat.undo()
        #expect(chat.project.captionStyle == project.captionStyle)
        ui.player.replaceCurrentItem(with: nil); chat.player.replaceCurrentItem(with: nil)
    }

    @Test func captionStyleOnSelectedCardsWritesOverridesAndSkipsLockedOnes() async throws {
        var project = fixture()
        project.captions![1].isLocked = true
        let targets = project.storedCaptions.map(\.id)
        let (chat, _) = await session(project) { _ in
            try Self.reply(CaptionStyleInput(captionIDs: targets, applyToAll: false, style: TextStyleInput(TextStylePatch(textCase: .upper))))
        }
        await chat.runAssistant(instruction: "uppercase these two")
        let receipt = try #require(chat.appActions.recentResults.last)
        #expect(receipt.status == .applied)
        #expect(receipt.skippedIDs == [targets[1]])
        #expect(receipt.changes.map(\.targetID) == [targets[0]])
        #expect(receipt.changes.first?.property == "style.appearance.textCase")
        #expect(chat.project.storedCaptions[0].overrides.textCase == .upper)
        #expect(chat.project.storedCaptions[1].overrides.textCase == nil)
        #expect(chat.project.captionStyle == project.captionStyle)
    }

    @Test func invalidColourEmptyPatchAndUnknownIDsAreRejectedWithoutMutation() async throws {
        let project = fixture()
        let (session, store) = await session(project) { _ in throw AppActionError("unused") }
        let cases: [any AppActionInput] = [
            CaptionStyleInput(captionIDs: [], applyToAll: true, style: TextStyleInput(TextStylePatch(color: nil))),
            TextLayerStyleInput(textLayerIDs: [UUID()], style: TextStyleInput(TextStylePatch(fontScale: 0.05))),
            VideoFramingInput(clipIDs: project.clips.map(\.id), scale: nil, x: nil, y: nil, rotation: nil),
            ClipRetouchInput(clipIDs: [UUID()], clearBlemishes: 0.5, whitenTeeth: nil),
            AudioVolumeInput(layerIDs: [], videoTrack: false, volume: 0.5),
        ]
        for input in cases {
            let result = await session.appActions.execute(try session.actionRequest(input), in: session)
            #expect(result.status == .rejected, "\(type(of: input))")
            #expect(session.project == project)
        }
        var bad = try session.actionRequest(ProjectBackdropInput(color: "#FF7A21"))
        bad = .init(protocolVersion: bad.protocolVersion, id: bad.id, projectID: bad.projectID, revision: bad.revision,
                    action: bad.action, arguments: ["color": .string("orange")])
        #expect(await session.appActions.execute(bad, in: session).status == .rejected)
        var outOfRange = try session.actionRequest(VideoFramingInput(clipIDs: [project.clips[0].id], scale: 1, x: nil, y: nil, rotation: nil))
        outOfRange = .init(protocolVersion: 1, id: outOfRange.id, projectID: outOfRange.projectID, revision: outOfRange.revision,
                           action: outOfRange.action, arguments: ["clipIDs": .array([.string(project.clips[0].id.uuidString)]), "scale": .number(9)])
        #expect(await session.appActions.execute(outOfRange, in: session).status == .rejected)
        #expect(session.project == project)
        #expect(await store.saves.isEmpty)
    }

    @Test func framingRetouchBackgroundAndBackdropMatchBetweenInspectorAndChirpy() async throws {
        let (project, root) = try await mediaFixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let clip = project.clips[0].id
        let (chat, _) = await session(project) { instruction in
            if instruction.contains("zoom") { return try Self.reply(VideoFramingInput(clipIDs: [clip], scale: 1.3, x: 0.1, y: 0, rotation: 0)) }
            if instruction.contains("skin") { return try Self.reply(ClipRetouchInput(clipIDs: [clip], clearBlemishes: 0.4, whitenTeeth: nil)) }
            if instruction.contains("background") { return try Self.reply(ClipBackgroundInput(clipIDs: [clip], removed: true)) }
            return try Self.reply(ProjectBackdropInput(color: "#112233"))
        }
        let (ui, _) = await session(project) { _ in throw AppActionError("unused") }
        ui.setFramingScale(1.3)
        await settle(ui, until: 1)
        ui.setFramingOffset(x: 0.1, y: 0)
        await settle(ui, until: 2)
        await chat.runAssistant(instruction: "zoom in 30% and nudge right")
        #expect(normalized(ui.project) == normalized(chat.project))
        #expect(chat.project.clips[0].framing == VideoFraming(scale: 1.3, x: 0.1, y: 0))
        let framingReceipt = try #require(chat.appActions.recentResults.last)
        #expect(framingReceipt.changes.map(\.property) == ["framing.scale", "framing.x"])
        #expect(framingReceipt.changes.map(\.before) == ["1.0", "0.0"])

        ui.applyRetouchToAllClips() // neutral on both, so nothing changes yet
        await Task.yield()
        ui.updateProject { $0.clips[0].retouch = ClipRetouch(clearBlemishes: 0.4) }
        await chat.runAssistant(instruction: "smooth my skin a bit")
        #expect(normalized(ui.project) == normalized(chat.project))
        #expect(chat.appActions.recentResults.last?.changes.first?.property == "retouch.clearBlemishes")

        ui.setBackgroundRemoved(true)
        await settle(ui, until: 3)
        await chat.runAssistant(instruction: "remove my background")
        #expect(normalized(ui.project) == normalized(chat.project))
        #expect(chat.project.clips[0].removesBackground)

        ui.setBackdrop(StudioColor(hex: "#112233")!)
        await settle(ui, until: 4)
        await chat.runAssistant(instruction: "make the backdrop navy")
        #expect(normalized(ui.project) == normalized(chat.project))
        #expect(chat.project.resolvedBackdrop.hex == StudioColor(hex: "#112233")!.hex)
        let backdropReceipt = try #require(chat.appActions.recentResults.last)
        #expect(backdropReceipt.changes == [.init(targetID: project.id, property: "backdrop", before: StudioColor.black.hex, after: StudioColor(hex: "#112233")!.hex)])
        // The locked second clip was never touched by any of it.
        #expect(chat.project.clips[1] == project.clips[1])
        ui.player.replaceCurrentItem(with: nil); chat.player.replaceCurrentItem(with: nil)
    }

    @Test func keyedClipsRefuseStaticFramingAndLockedClipsAreSkipped() async throws {
        var project = fixture()
        project.clips[0] = VideoFramingTrack.setting(VideoFraming(scale: 2, x: 0, y: 0), atSource: 0.5, in: project.clips[0])
        let (session, store) = await session(project) { _ in throw AppActionError("unused") }
        let keyed = await session.appActions.execute(
            try session.actionRequest(VideoFramingInput(clipIDs: [project.clips[0].id], scale: 1.5, x: nil, y: nil, rotation: nil)), in: session)
        #expect(keyed.status == .rejected)
        #expect(keyed.message.contains("keyframes"))
        let locked = await session.appActions.execute(
            try session.actionRequest(ClipBackgroundInput(clipIDs: [project.clips[1].id], removed: true)), in: session)
        #expect(locked.status == .unchanged)
        #expect(locked.skippedIDs == [project.clips[1].id])
        #expect(session.project == project)
        #expect(await store.saves.isEmpty)
    }

    @Test func volumeFromFaderAndChirpyMatchAndUnmuteTheVideoTrack() async throws {
        var (project, root) = try await mediaFixture()
        defer { try? FileManager.default.removeItem(at: root) }
        project.videoTrackMuted = true
        let layer = project.audioLayers![0].id
        let (chat, _) = await session(project) { instruction in
            instruction.contains("click")
                ? try Self.reply(AudioVolumeInput(layerIDs: [layer], videoTrack: false, volume: 0.3))
                : try Self.reply(AudioVolumeInput(layerIDs: [], videoTrack: true, volume: 0.8))
        }
        let (ui, _) = await session(project) { _ in throw AppActionError("unused") }
        ui.previewVolume(0.3, for: layer)
        ui.commitLayerVolume()
        await settle(ui, until: 1)
        ui.previewVideoTrackVolume(0.8)
        ui.commitVideoTrackVolume()
        await settle(ui, until: 2)
        await chat.runAssistant(instruction: "turn the click down to 30%")
        await chat.runAssistant(instruction: "my voice at 80%")
        #expect(normalized(ui.project) == normalized(chat.project))
        #expect(chat.project.audioLayers?[0].volume == 0.3)
        #expect(chat.project.resolvedVideoTrackVolume == 0.8)
        #expect(chat.project.videoTrackMuted == nil)
        let receipt = try #require(chat.appActions.recentResults.last)
        #expect(receipt.changes.map(\.property) == ["videoTrackVolume", "videoTrackMuted"])
        ui.player.replaceCurrentItem(with: nil); chat.player.replaceCurrentItem(with: nil)
    }

    @Test func textLayerStyleAndTemplateGoThroughTheAction() async throws {
        let project = fixture()
        let layer = project.textLayers![0].id
        let (chat, _) = await session(project) { _ in
            try Self.reply(TextLayerStyleInput(textLayerIDs: [layer], style: TextStyleInput(TextStylePatch(y: 0.5, fontScale: 0.12))))
        }
        let (ui, _) = await session(project) { _ in throw AppActionError("unused") }
        ui.applyTextLayerStyle(TextStylePatch(y: 0.5, fontScale: 0.12), to: layer)
        await settle(ui, until: 1)
        await chat.runAssistant(instruction: "centre the hook and make it big")
        #expect(normalized(ui.project) == normalized(chat.project))
        #expect(chat.project.textLayers?[0].y == 0.5)
        #expect(chat.appActions.recentResults.last?.changes.map(\.property) == ["style.appearance.fontScale", "style.y"])
        ui.applyTextLayerTemplate(TextTemplate.all[0], to: layer)
        await settle(ui, until: 2)
        #expect(ui.appActions.recentResults.last?.action == AppActionID.textLayerStyle.rawValue)
    }
}
