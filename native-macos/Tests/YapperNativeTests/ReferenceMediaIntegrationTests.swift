@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private let djiReferenceURL = URL(
    filePath: "/Volumes/G Micro Pro/DCIM/DJI_001/DJI_20260719173505_0045_D.MP4"
)

@Suite(.serialized)
struct ReferenceMediaIntegrationTests {
    @Test(
        "DJI transcription and AI edit preserve complete final takes",
        .enabled(if: ProcessInfo.processInfo.environment["YAPPER_RUN_TRANSCRIPTION_INTEGRATION"] == "1")
    )
    func transcribesCompleteReferenceSpeech() async throws {
        let media = try await MediaProbe.inspect(url: djiReferenceURL)
        let service = AIEditService()
        let words = try await service.transcribe(media: media)
        let tokens = words.map {
            $0.text.lowercased().filter { $0.isLetter || $0.isNumber || $0 == "'" }
        }

        #expect(words.count >= 700)
        #expect(contains(tokens, sequence: ["three", "months", "ago", "i", "started", "building"]))
        #expect(contains(tokens, sequence: ["you", "have", "everything", "you", "need", "to", "practice", "for", "the", "exam"]))
        #expect((words.last?.end ?? 0) > 370)

        let cuts = try await service.cleanCuts(words: words)
        var removed = Array(repeating: false, count: words.count)
        for (start, end) in cuts {
            guard words.indices.contains(start), words.indices.contains(end) else { continue }
            for index in min(start, end) ... max(start, end) { removed[index] = true }
        }
        let kept = tokens.enumerated().compactMap { removed[$0.offset] ? nil : $0.element }
        #expect(!cuts.isEmpty)
        #expect(contains(kept, sequence: ["three", "months", "ago", "i", "started", "building"]))
        #expect(occurrences(
            of: ["you", "can", "take", "full", "practice", "tests", "drill", "individual", "questions", "or", "go", "through", "the", "course", "modules", "directly", "at", "the", "site"],
            in: kept
        ) == 1)
        #expect(occurrences(
            of: ["plus", "eight", "free", "credits", "to", "try", "the", "ai", "feedback"],
            in: kept
        ) == 1)
    }

    @Test(
        "DJI source builds a 50-cut continuous composition",
        .enabled(if: FileManager.default.fileExists(atPath: djiReferenceURL.path))
    )
    func buildsContinuousComposition() async throws {
        let media = try await MediaProbe.inspect(url: djiReferenceURL)
        let clipLength = 0.8
        let clips = (0 ..< 50).map { index in
            let start = 20.0 + Double(index) * 1.1
            return TimelineClip(
                mediaID: media.id,
                sourceStart: start,
                sourceEnd: start + clipLength
            )
        }
        let project = EditorProject(name: "DJI benchmark", media: [media], clips: clips)

        let clock = ContinuousClock()
        let start = clock.now
        let built = try await CompositionBuilder.build(project: project)
        let elapsed = start.duration(to: clock.now)
        let videoTracks = try await built.asset.loadTracks(withMediaType: .video)
        let audioTracks = try await built.asset.loadTracks(withMediaType: .audio)

        #expect(videoTracks.count == 1)
        #expect(audioTracks.count == 1)
        // Camera video samples land on encoded frame boundaries. Across 50
        // inserts the aggregate rounding stays below one tenth of a second.
        #expect(abs(built.asset.duration.seconds - 40) < 0.1)
        #expect(elapsed < .seconds(2))
    }

    @Test(
        "DJI cut export contains synchronized audio",
        .enabled(if: FileManager.default.fileExists(atPath: djiReferenceURL.path))
    )
    func exportsAudioAndVideo() async throws {
        let media = try await MediaProbe.inspect(url: djiReferenceURL)
        let project = EditorProject(
            name: "DJI export check",
            media: [media],
            clips: [
                TimelineClip(mediaID: media.id, sourceStart: 20, sourceEnd: 22),
                TimelineClip(mediaID: media.id, sourceStart: 24, sourceEnd: 26),
                TimelineClip(mediaID: media.id, sourceStart: 28, sourceEnd: 30),
            ]
        )
        let output = FileManager.default.temporaryDirectory
            .appending(path: "yapper-native-reference-export.mp4")
        defer { try? FileManager.default.removeItem(at: output) }

        try await ExportService.export(project: project, to: output)

        let rendered = AVURLAsset(url: output)
        let videoTracks = try await rendered.loadTracks(withMediaType: .video)
        let audioTracks = try await rendered.loadTracks(withMediaType: .audio)
        let duration = try await rendered.load(.duration).seconds
        #expect(videoTracks.count == 1)
        #expect(audioTracks.count == 1)
        #expect(abs(duration - 6) < 0.15)
        #expect((try FileManager.default.attributesOfItem(atPath: output.path)[.size] as? Int ?? 0) > 0)
    }

    @Test(
        "DJI export renders an image overlay without losing audio",
        .enabled(if: FileManager.default.fileExists(atPath: djiReferenceURL.path))
    )
    func exportsImageOverlay() async throws {
        let video = try await MediaProbe.inspect(url: djiReferenceURL)
        let imageURL = FileManager.default.temporaryDirectory.appending(path: "yapper-overlay-check.png")
        let output = FileManager.default.temporaryDirectory.appending(path: "yapper-overlay-check.mp4")
        defer {
            try? FileManager.default.removeItem(at: imageURL)
            try? FileManager.default.removeItem(at: output)
        }

        let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: 320,
            pixelsHigh: 180,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        )!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        NSColor.magenta.setFill()
        NSBezierPath(rect: CGRect(x: 0, y: 0, width: 320, height: 180)).fill()
        NSGraphicsContext.restoreGraphicsState()
        try bitmap.representation(using: .png, properties: [:])!.write(to: imageURL)

        let image = try await MediaProbe.inspect(url: imageURL)
        let project = EditorProject(
            name: "Overlay export check",
            media: [video, image],
            clips: [TimelineClip(mediaID: video.id, sourceStart: 20, sourceEnd: 24)],
            overlays: [ProjectOverlay(mediaID: image.id, timelineStart: 0.5, duration: 2)]
        )
        try await ExportService.export(project: project, to: output)

        let rendered = AVURLAsset(url: output)
        #expect(try await rendered.loadTracks(withMediaType: .video).count == 1)
        #expect(try await rendered.loadTracks(withMediaType: .audio).count == 1)
        #expect(abs(try await rendered.load(.duration).seconds - 4) < 0.15)
    }

    @Test(
        "DJI export renders native text layers without losing audio",
        .enabled(if: FileManager.default.fileExists(atPath: djiReferenceURL.path))
    )
    func exportsTextLayer() async throws {
        let video = try await MediaProbe.inspect(url: djiReferenceURL)
        let output = FileManager.default.temporaryDirectory.appending(path: "yapper-text-layer-check.mp4")
        defer { try? FileManager.default.removeItem(at: output) }

        let project = EditorProject(
            name: "Text export check",
            media: [video],
            clips: [TimelineClip(mediaID: video.id, sourceStart: 20, sourceEnd: 23)],
            textLayers: [
                ProjectTextLayer(
                    text: "Native text stays in the export",
                    timelineStart: 0.25,
                    duration: 2.25,
                    y: 0.16,
                    style: .whiteCard,
                    font: .rounded
                ),
            ]
        )

        let built = try await CompositionBuilder.build(project: project)
        #expect(built.videoComposition?.animationTool != nil)
        #expect(built.playbackVideoComposition?.animationTool == nil)
        try await ExportService.export(project: project, to: output)

        let rendered = AVURLAsset(url: output)
        #expect(try await rendered.loadTracks(withMediaType: .video).count == 1)
        #expect(try await rendered.loadTracks(withMediaType: .audio).count == 1)
        #expect(abs(try await rendered.load(.duration).seconds - 3) < 0.15)
    }

    @Test(
        "DJI export mixes a native sound effect with source audio",
        .enabled(if: FileManager.default.fileExists(atPath: djiReferenceURL.path))
    )
    func exportsSoundEffectMix() async throws {
        let video = try await MediaProbe.inspect(url: djiReferenceURL)
        let effect = SoundEffectDescriptor.library.first { $0.id == "pop" }!
        let effectURL = try await SoundEffectService.shared.fileURL(for: effect)
        let output = FileManager.default.temporaryDirectory.appending(path: "yapper-sound-effect-check.mp4")
        defer { try? FileManager.default.removeItem(at: output) }

        let project = EditorProject(
            name: "Sound effect export check",
            media: [video],
            clips: [TimelineClip(mediaID: video.id, sourceStart: 20, sourceEnd: 23)],
            audioLayers: [
                ProjectAudioLayer(
                    url: effectURL,
                    name: effect.name,
                    timelineStart: 0.75,
                    duration: effect.duration,
                    builtInID: effect.id
                ),
            ]
        )
        let built = try await CompositionBuilder.build(project: project)
        #expect(try await built.asset.loadTracks(withMediaType: .audio).count == 2)
        #expect(built.audioMix?.inputParameters.count == 1)

        try await ExportService.export(project: project, to: output)
        let rendered = AVURLAsset(url: output)
        #expect(try await rendered.loadTracks(withMediaType: .video).count == 1)
        #expect(try await rendered.loadTracks(withMediaType: .audio).count == 1)
        #expect(abs(try await rendered.load(.duration).seconds - 3) < 0.15)
    }

    private func contains(_ tokens: [String], sequence: [String]) -> Bool {
        occurrences(of: sequence, in: tokens) > 0
    }

    private func occurrences(of sequence: [String], in tokens: [String]) -> Int {
        guard !sequence.isEmpty, tokens.count >= sequence.count else { return 0 }
        return tokens.indices.dropLast(sequence.count - 1).filter { start in
            Array(tokens[start ..< start + sequence.count]) == sequence
        }.count
    }
}
