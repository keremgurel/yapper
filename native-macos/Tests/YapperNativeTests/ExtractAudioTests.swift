@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor ExtractAudioTestStore: ProjectPersisting {
    var fail = false
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {
        if fail { throw AppActionError("Test save failure") }
    }
    func failSaves() { fail = true }
}

@MainActor
@Suite(.serialized)
struct ExtractAudioTests {
    private func fixture() -> EditorProject {
        let media = ProjectMedia(url: URL(filePath: "/tmp/extract.mov"), name: "Take", duration: 20,
                                 width: 160, height: 90, hasAudio: true, sourceFingerprint: "fingerprint")
        return EditorProject(media: [media], clips: [
            TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 3),
            TimelineClip(mediaID: media.id, sourceStart: 4, sourceEnd: 12, playbackRate: 2),
        ])
    }

    @Test func extractionPreservesTimingVolumeAndSourceAndCanOnlyRunOnce() throws {
        var project = fixture()
        project.videoTrackVolume = 0.6
        let clip = project.clips[1]
        let extractedAudio = project.extractAudio(from: .clip(clip.id))
        let layer = try #require(extractedAudio)
        #expect(layer.timelineStart == 3)
        #expect(layer.duration == 4)
        #expect(layer.sourceStart == 4)
        #expect(layer.sourceEnd == 12)
        #expect(layer.sourceDuration == 20)
        #expect(layer.resolvedPlaybackRate == 2)
        #expect(layer.volume == 0.6)
        #expect(layer.url == project.media[0].url)
        #expect(layer.sourceFingerprint == "fingerprint")
        #expect(project.clips[0].audioDetached == nil)
        #expect(project.clips[1].audioDetached == true)
        let duplicateIsSkipped = project.extractAudio(from: .clip(clip.id)) == nil
        #expect(duplicateIsSkipped)
        #expect(project.audioLayers?.count == 1)
        let decoded = try JSONDecoder().decode(EditorProject.self, from: JSONEncoder().encode(project))
        #expect(decoded == project)
        let didSplit = project.split(clipID: clip.id, atTimelineTime: 5)
        #expect(didSplit)
        #expect(project.clips.suffix(2).allSatisfy { $0.audioDetached == true })
        let audioBefore = project.audioLayers
        let didDelete = project.delete(clipID: project.clips[1].id)
        #expect(didDelete)
        #expect(project.audioLayers == audioBefore)
    }

    @Test func silentLockedAndStillClipsAreIneligibleAndOldProjectsRemainAudible() throws {
        var project = fixture()
        let id = project.clips[0].id
        project.clips[0].isLocked = true
        let lockedIsSkipped = project.extractAudio(from: .clip(id)) == nil
        #expect(lockedIsSkipped)
        project.clips[0].isLocked = nil
        project.media[0].hasAudio = false
        let silentIsSkipped = project.extractAudio(from: .clip(id)) == nil
        #expect(silentIsSkipped)
        project.media[0].hasAudio = true
        project.media[0].kind = .image
        let imageIsSkipped = project.extractAudio(from: .clip(id)) == nil
        #expect(imageIsSkipped)
        let missingIsSkipped = project.extractAudio(from: .clip(UUID())) == nil
        #expect(missingIsSkipped)
        let oldClip = Data("{\"id\":\"\(UUID())\",\"mediaID\":\"\(UUID())\",\"sourceStart\":0,\"sourceEnd\":4}".utf8)
        #expect(try JSONDecoder().decode(TimelineClip.self, from: oldClip).audioDetached == nil)
        let audio = ProjectAudioLayer(url: URL(filePath: "/tmp/tone.wav"), name: "tone", timelineStart: 0, duration: 2)
        #expect(try JSONDecoder().decode(ProjectAudioLayer.self, from: JSONEncoder().encode(audio)).resolvedPlaybackRate == 1)
    }

    @Test func overlayExtractionAndLaneChangesKeepAudioDetached() throws {
        var project = fixture()
        let overlay = ProjectOverlay(mediaID: project.media[0].id, timelineStart: 1, duration: 2,
                                     sourceStart: 5, playbackRate: 0.5)
        project.overlays = [overlay]
        let extractedAudio = project.extractAudio(from: .overlay(overlay.id))
        let audio = try #require(extractedAudio)
        #expect(audio.timelineStart == 1)
        #expect(audio.sourceEnd == 6)
        #expect(audio.resolvedPlaybackRate == 0.5)
        let demotedClip = project.demoteOverlayToClip(overlay.id, insertionIndex: 1)
        let clip = try #require(demotedClip)
        #expect(clip.audioDetached == true)
        let promotedOverlay = project.promoteClipToOverlay(clip.id)
        let lifted = try #require(promotedOverlay)
        #expect(lifted.audioDetached == true)
        #expect(!project.canExtractAudio(from: .overlay(lifted.id)))
    }

    @Test func speedAdjustedAudioTrimsInSourceSeconds() throws {
        var project = fixture()
        let extractedAudio = project.extractAudio(from: .clip(project.clips[1].id))
        let layer = try #require(extractedAudio)
        let head = TimelineAudioGeometry.trimmed(layer: layer, edge: .leading, translationX: 100,
            contentWidth: 1000, projectDuration: 10)
        #expect(head.timelineStart == 4)
        #expect(head.sourceStart == 6)
        #expect(head.duration == 3)
        #expect(head.sourceEnd == 12)
        let tail = TimelineAudioGeometry.trimmed(layer: layer, edge: .trailing, translationX: -100,
            contentWidth: 1000, projectDuration: 10)
        #expect(tail.sourceStart == 4)
        #expect(tail.sourceEnd == 10)
        #expect(tail.duration == 3)
    }

    @Test func extractedPackagedAudioTravelsWithoutItsOriginalVideo() throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "extract-package-\(UUID())")
        let destination = root.appending(path: "copy")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        var project = fixture()
        let source = root.appending(path: "source.mov")
        try Data("recording bytes".utf8).write(to: source)
        project.media[0].url = source
        project.media[0].packagedSource = true
        let extractedAudio = project.extractAudio(from: .clip(project.clips[1].id))
        let layer = try #require(extractedAudio)
        let mediaID = try #require(layer.packagedMediaID)
        try PackagedMediaLayout.copyAssets(in: project, to: destination)
        project.media = []
        let relocated = PackagedMediaLayout.relocated(project, to: destination)
        let moved = try #require(relocated.audioLayers?.first)
        #expect(moved.url == PackagedMediaLayout.file(for: mediaID, extension: "mov", in: destination))
        #expect(try Data(contentsOf: moved.url) == Data("recording bytes".utf8))
        let secondCopy = root.appending(path: "audio-only-copy")
        try PackagedMediaLayout.copyAssets(in: relocated, to: secondCopy)
        let copied = PackagedMediaLayout.relocated(relocated, to: secondCopy)
        #expect(FileManager.default.fileExists(atPath: try #require(copied.audioLayers?.first?.url.path)))
    }

    @Test func extractionPlaybackExportUndoAndIndependentEditing() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "extract-audio-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let source = try await makeVideoWithTone(in: root)
        let session = EditorSession(store: ExtractAudioTestStore())
        await session.importMedia([source])
        defer { session.player.replaceCurrentItem(with: nil) }
        let media = try #require(session.project.media.first)
        session.updateProject { project in
            project.clips = [
                TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 1, isLocked: true),
                TimelineClip(mediaID: media.id, sourceStart: 1, sourceEnd: 5, playbackRate: 2),
                TimelineClip(mediaID: media.id, sourceStart: 5, sourceEnd: 6),
            ]
            project.videoTrackVolume = 0.5
        }
        let before = session.project
        let clip = before.clips[1]
        session.setTimelineSelection(Set(before.clips.prefix(2).map { .clip($0.id) }))
        #expect(await session.extractAudio(from: .clip(clip.id)))
        let extracted = session.project
        let layer = try #require(extracted.audioLayers?.first)
        #expect(layer.timelineStart == 1)
        #expect(layer.duration == 2)
        #expect(session.timelineSelection == [.audio(layer.id)])
        #expect(session.statusMessage.contains("1 skipped"))
        let built = try await CompositionBuilder.build(project: extracted)
        let tracks = try await built.asset.loadTracks(withMediaType: .audio)
        #expect(tracks.count == 2)
        let mainSegments = try await tracks[0].load(.segments)
        #expect(mainSegments.contains { $0.isEmpty && abs($0.timeMapping.target.start.seconds - 1) < 0.01
            && abs($0.timeMapping.target.duration.seconds - 2) < 0.01 })
        let detachedSegments = try await tracks[1].load(.segments)
        let audible = try #require(detachedSegments.first { !$0.isEmpty })
        #expect(abs(audible.timeMapping.source.start.seconds - 1) < 0.01)
        #expect(abs(audible.timeMapping.source.duration.seconds - 4) < 0.01)
        #expect(abs(audible.timeMapping.target.start.seconds - 1) < 0.01)
        #expect(abs(audible.timeMapping.target.duration.seconds - 2) < 0.01)
        #expect(built.audioMix?.inputParameters.allSatisfy { $0.audioTimePitchAlgorithm == .spectral } == true)
        let output = root.appending(path: "export.mp4")
        try await ExportService.export(project: extracted, to: output)
        let samples = try await readAudio(AVURLAsset(url: output))
        let start = 48000 * 3 / 2, end = 48000 * 5 / 2
        #expect(samples.count >= end)
        let crossings = (start + 1..<end).count { samples[$0 - 1] <= 0 && samples[$0] > 0 }
        #expect(abs(Double(crossings) - 220) < 4)
        let rms = sqrt(samples[start..<end].reduce(0.0) { $0 + Double($1 * $1) } / Double(end - start))
        #expect(rms > 0.10 && rms < 0.18, "Expected one audio copy at 50% volume, got RMS \(rms)")
        await session.undo()
        #expect(session.project == before)
        await session.redo()
        #expect(session.project == extracted)
        session.setTimelineSelection([.audio(layer.id)])
        session.seekToTimelineTime(2)
        await session.splitAtPlayhead()
        let halves = try #require(session.project.audioLayers)
        #expect(halves.count == 2)
        #expect(halves[1].sourceStart == 3)
        #expect(halves.allSatisfy { $0.resolvedPlaybackRate == 2 })
        #expect(session.project.clips == extracted.clips)
        await session.deleteSelected()
        #expect(session.project.audioLayers?.count == 1)
        #expect(session.project.clips == extracted.clips)
    }

    @Test func failedSaveRollsBackVideoMuteAndAudioLayerTogether() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "extract-failure-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let source = try await makeVideoWithTone(in: root)
        let store = ExtractAudioTestStore()
        let session = EditorSession(store: store)
        await session.importMedia([source])
        defer { session.player.replaceCurrentItem(with: nil) }
        let before = session.project
        await store.failSaves()
        #expect(await session.extractAudio(from: .clip(before.clips[0].id)) == false)
        #expect(session.project == before)
    }

    private func makeVideoWithTone(in root: URL) async throws -> URL {
        let video = root.appending(path: "silent.mov"), audio = root.appending(path: "tone.wav")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 6, to: video)
        let format = try #require(AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1))
        let buffer = try #require(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 48000 * 6))
        buffer.frameLength = buffer.frameCapacity
        let samples = try #require(buffer.floatChannelData?[0])
        for index in 0..<Int(buffer.frameLength) { samples[index] = Float(0.4 * sin(2 * .pi * 220 * Double(index) / 48000)) }
        do {
            let file = try AVAudioFile(forWriting: audio, settings: format.settings)
            try file.write(from: buffer)
        }
        let videoAsset = AVURLAsset(url: video)
        let audioAsset = AVURLAsset(url: audio)
        let videoTrack = try #require(try await videoAsset.loadTracks(withMediaType: .video).first)
        let audioTrack = try #require(try await audioAsset.loadTracks(withMediaType: .audio).first)
        let composition = AVMutableComposition()
        let range = CMTimeRange(start: .zero, duration: CMTime(seconds: 6, preferredTimescale: 600))
        try composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)?.insertTimeRange(range, of: videoTrack, at: .zero)
        try composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)?.insertTimeRange(range, of: audioTrack, at: .zero)
        let output = root.appending(path: "source.mov")
        let exporter = try #require(AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality))
        exporter.outputURL = output
        exporter.outputFileType = .mov
        await exporter.export()
        #expect(exporter.status == .completed)
        return output
    }

    private func readAudio(_ asset: AVAsset) async throws -> [Float] {
        let track = try #require(try await asset.loadTracks(withMediaType: .audio).first)
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
            AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 32, AVLinearPCMIsFloatKey: true, AVLinearPCMIsNonInterleaved: false,
        ])
        reader.add(output)
        #expect(reader.startReading())
        var samples: [Float] = []
        while let buffer = output.copyNextSampleBuffer(), let block = CMSampleBufferGetDataBuffer(buffer) {
            var values = [Float](repeating: 0, count: CMBlockBufferGetDataLength(block) / 4)
            let status = values.withUnsafeMutableBytes {
                CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: $0.count, destination: $0.baseAddress!)
            }
            #expect(status == kCMBlockBufferNoErr)
            samples += values
        }
        #expect(reader.status == .completed)
        return samples
    }
}
