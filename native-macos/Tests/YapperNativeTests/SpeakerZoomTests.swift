@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor SpeakerZoomStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {}
}

@MainActor
@Suite(.serialized)
struct SpeakerZoomTests {
    private func request(_ anchor: TimelineAnchorKind = .phrase, phrase: String? = "hello world", occurrence: Int? = nil,
                         time: Double? = nil) -> SpeakerZoomPreset {
        .init(anchor: anchor, phrase: phrase, occurrence: occurrence, time: time, amount: 1.3, attack: 0.16, hold: 0.2, release: 0.2)
    }

    @Test func speechCuesFollowKeptWordsAndPlaybackRates() throws {
        let mediaID = UUID()
        let words = [TranscriptWord(mediaID: mediaID, text: "Deleted", start: 0, end: 0.2),
            .init(mediaID: mediaID, text: "Hello,", start: 2.2, end: 2.4),
            .init(mediaID: mediaID, text: "world!", start: 2.5, end: 2.8)]
        var project = EditorProject(clips: [.init(mediaID: mediaID, sourceStart: 2, sourceEnd: 4, playbackRate: 2)])
        project.transcript = words
        #expect(abs(try TimelineCue.resolve(request(.speechStart).cue, project: project, playhead: 0) - 0.1) < 1e-8)
        #expect(abs(try TimelineCue.resolve(request(phrase: "HELLO world").cue, project: project, playhead: 0) - 0.1) < 1e-8)
        project.clips.append(.init(mediaID: mediaID, sourceStart: 2, sourceEnd: 4))
        #expect(throws: AppActionError.self) { try TimelineCue.resolve(request().cue, project: project, playhead: 0) }
        #expect(abs(try TimelineCue.resolve(request(occurrence: 2).cue, project: project, playhead: 0) - 1.2) < 1e-8)
        #expect(throws: AppActionError.self) { try TimelineCue.resolve(request(phrase: "Deleted").cue, project: project, playhead: 0) }
        #expect(throws: AppActionError.self) { try TimelineCue.resolve(request(phrase: "unknown words").cue, project: project, playhead: 0) }
    }

    @Test func smoothMoveKeepsOtherFramingAndSurvivesInsertedKeysAndSplits() throws {
        var clip = TimelineClip(mediaID: UUID(), sourceStart: 2, sourceEnd: 10, playbackRate: 2)
        clip.framingKeys = [.init(at: 2, framing: .identity), .init(at: 10, framing: .init(scale: 1.1, x: 0.1, y: 0))]
        let zoom = FramingAnimationTrack.applying(to: clip, clipStart: 0, keys: [
                .init(time: 1, scale: 1, easing: .smooth), .init(time: 1.4, scale: 1.3, easing: .smooth),
                .init(time: 1.6, scale: 1.3, easing: .smooth), .init(time: 2, scale: 1)], face: nil, sourceAspect: 16.0/9, frameAspect: 16.0/9)
        for time in [2.0, 3.0, 7.0, 9.0] {
            let old = VideoFramingTrack.framing(of: clip, atSource: time), new = VideoFramingTrack.framing(of: zoom, atSource: time)
            #expect(abs(old.scale - new.scale) < 1e-8)
            #expect(abs(old.x - new.x) < 1e-8)
        }
        let inserted = VideoFramingTrack.setting(VideoFramingTrack.framing(of: zoom, atSource: 4.2), atSource: 4.2, in: zoom)
        for time in stride(from: 4.0, through: 6.0, by: 0.05) {
            #expect(abs(VideoFramingTrack.framing(of: zoom, atSource: time).scale - VideoFramingTrack.framing(of: inserted, atSource: time).scale) < 1e-8)
        }
        var project = EditorProject(clips: [zoom])
        let split = project.split(clipID: zoom.id, atTimelineTime: 1.1)
        #expect(split)
        #expect(VideoFramingTrack.framing(of: project.clips[1], atSource: 4.3) == VideoFramingTrack.framing(of: zoom, atSource: 4.3))
        #expect(try JSONDecoder().decode(TimelineClip.self, from: JSONEncoder().encode(zoom)) == zoom)
        #expect(VideoFramingTrack.sampleTimes(of: zoom).count > VideoFramingTrack.keys(of: zoom).count)
    }

    @Test func faceRemainsAtTheSamePointWhileZooming() {
        let face = CGRect(x: 0.7, y: 0.25, width: 0.1, height: 0.2)
        let frame = VideoFraming(scale: 1.1, x: 0.05, y: 0.03)
        let zoom = FramingAnimationTrack.focused(frame, amount: 1.4, face: face, sourceAspect: 16.0/9, frameAspect: 16.0/9)
        #expect(abs(frame.x + frame.scale * (face.midX - 0.5) - zoom.x - zoom.scale * (face.midX - 0.5)) < 1e-8)
        #expect(abs(frame.y + frame.scale * (face.midY - 0.5) - zoom.y - zoom.scale * (face.midY - 0.5)) < 1e-8)
    }

    @Test(arguments: [false, true]) func actionPersistsAcrossCutRendersAndUndoes(filtered: Bool) async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "speaker-zoom-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let url = root.appending(path: "speaker.mov")
        try await SyntheticVideo.write(color: NSColor.red.cgColor, size: .init(width: 320, height: 180), seconds: 4, to: url)
        let media = try await MediaProbe.inspect(url: url)
        var first = TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 2, playbackRate: 2)
        first.framing = .init(scale: 0.6, x: 0, y: 0)
        var second = TimelineClip(mediaID: media.id, sourceStart: 2, sourceEnd: 4)
        second.framing = first.framing
        var project = EditorProject(media: [media], clips: [first, second])
        project.transcript = [.init(mediaID: media.id, text: "hello", start: 1.8, end: 1.9),
                              .init(mediaID: media.id, text: "world", start: 2, end: 2.2)]
        if filtered { project.visualFilter = .init(id: .warm, strength: 0.2) }
        let session = EditorSession(store: SpeakerZoomStore())
        await Task.yield()
        session.updateProject { $0 = project }
        let original = session.project
        let result = await session.performAppAction(request().animation)
        #expect(result.status == .applied)
        #expect(result.persisted)
        #expect(result.message.contains("no face"))
        #expect(session.project.media == original.media)
        #expect(session.project.overlays == original.overlays)
        #expect(session.project.transcript == original.transcript)
        #expect(session.project.clips.allSatisfy { VideoFramingTrack.isKeyed($0) })
        #expect(VideoFramingTrack.framing(of: session.project.clips[1], atSource: 2.2).scale > 0.77)
        #expect(abs(VideoFramingTrack.framing(of: session.project.clips[1], atSource: 3).scale - 0.6) < 1e-8)
        let inspection = try await TimelineInspectionService.render(project: session.project)
        defer { inspection.discard() }
        let evidence = try await inspection.inspect(times: [0.7, 1.15, 1.7])
        let frames = try #require(evidence["frames"] as? [[String: Any]])
        func red(_ index: Int) throws -> CGFloat {
            let jpeg = try #require(frames[index]["jpeg"] as? String)
            let bytes = try #require(Data(base64Encoded: jpeg))
            let bitmap = try #require(NSBitmapImageRep(data: bytes))
            return try #require(bitmap.colorAt(x: Int(Double(bitmap.pixelsWide) * 0.16), y: bitmap.pixelsHigh / 2)?.usingColorSpace(.sRGB)).redComponent
        }
        #expect(try red(0) < 0.2)
        #expect(try red(1) > 0.6) // Picture grows past this point during the punch-in.
        #expect(try red(2) < 0.2) // The return restores the previous frame.
        await session.undo()
        #expect(session.project == original)
        session.updateProject { $0.clips[1].isLocked = true }
        let locked = session.project
        let rejected = await session.performAppAction(request().animation)
        #expect(rejected.status == .rejected)
        #expect(session.project == locked)
        session.updateProject { $0 = original; $0.clips[0].framing = .init(scale: 5, x: 0, y: 0) }
        let maximum = session.project
        #expect(await session.performAppAction(request().animation).status == .rejected)
        #expect(session.project == maximum)
        session.player.replaceCurrentItem(with: nil)
    }
}

@MainActor
@Suite(.serialized)
struct SpeakerZoomAcceptanceTests {
    @Test(.enabled(if: ProcessInfo.processInfo.environment["SPEAKER_ZOOM_QA_MEDIA"] != nil))
    func realFaceZoomOnSeparateDemo() async throws {
        let env = ProcessInfo.processInfo.environment
        let url = URL(fileURLWithPath: try #require(env["SPEAKER_ZOOM_QA_MEDIA"]))
        let output = URL(fileURLWithPath: try #require(env["SPEAKER_ZOOM_QA_OUTPUT"]))
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        let media = try await MediaProbe.inspect(url: url)
        let session = EditorSession(store: SpeakerZoomStore())
        await Task.yield()
        session.updateProject { $0 = EditorProject(name: "Speaker zoom demo", media: [media],
            clips: [.init(mediaID: media.id, sourceStart: 0, sourceEnd: min(6, media.duration))]) }
        let input = SpeakerZoomPreset(anchor: .time, phrase: nil, occurrence: nil, time: 1,
            amount: 1.25, attack: 0.2, hold: 0.4, release: 0.2)
        let result = await session.performAppAction(input.animation)
        #expect(result.status == .applied)
        #expect(!result.message.contains("no face"))
        let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
        try encoder.encode(session.project).write(to: output.appending(path: "project.json"))
        let inspection = try await TimelineInspectionService.render(project: session.project)
        defer { inspection.discard() }
        try FileManager.default.copyItem(at: inspection.url, to: output.appending(path: "speaker-zoom.mp4"))
        let evidence = try await inspection.inspect(times: [0.9, 1.3, 2])
        for (index, frame) in (evidence["frames"] as? [[String: Any]] ?? []).enumerated() {
            if let jpeg = frame["jpeg"] as? String, let data = Data(base64Encoded: jpeg) {
                try data.write(to: output.appending(path: "frame-\(index).jpg"))
            }
        }
        session.player.replaceCurrentItem(with: nil)
    }
}

/// A convenience preset composes ordinary keyframes; it is not a separate Chirpy capability.
struct SpeakerZoomPreset {
    var anchor: TimelineAnchorKind
    var phrase: String?
    var occurrence: Int?
    var time: Double?
    var amount: Double?
    var attack: Double?
    var hold: Double?
    var release: Double?
    var cue: TimelineAnchorInput { .init(kind: anchor, time: time, phrase: phrase, occurrence: occurrence, eventID: nil, offset: nil) }
    var animation: FramingAnimationInput {
        let attack = attack ?? 0.16, hold = hold ?? 0.2, release = release ?? 0.2
        return .init(keys: zip([0, attack, attack + hold, attack + hold + release], [1, amount ?? 1.2, amount ?? 1.2, 1]).map {
            .init(at: .init(kind: anchor, time: time, phrase: phrase, occurrence: occurrence, eventID: nil, offset: $0),
                scaleMultiplier: $1, x: nil, y: nil, rotation: nil, easing: .smooth)
        }, pivot: .face)
    }
}
