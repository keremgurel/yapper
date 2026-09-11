@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor SpeedTestStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_: EditorProject) async throws {}
}

@MainActor
@Suite(.serialized)
struct ClipSpeedTests {
    @Test func sourceMappingCaptionsSplitsAndTrimsUseClipSpeed() throws {
        let mediaID = UUID()
        let clip = TimelineClip(mediaID: mediaID, sourceStart: 10, sourceEnd: 18, playbackRate: 2)
        let word = TranscriptWord(mediaID: mediaID, text: "hello", start: 12, end: 13)
        var project = EditorProject(clips: [clip], transcript: [word], captionsEnabled: true)
        #expect(project.duration == 4)
        #expect(project.clip(at: 2)?.sourceTime == 14)
        #expect(project.timelineTime(for: word) == 1)
        #expect(project.timelineEnd(for: word) == 1.5)
        #expect(project.captionAnchor(atTimelineTime: 2)?.sourceTime == 14)
        #expect(project.timelineTime(forSource: 14, mediaID: mediaID) == 2)
        let timed = TimelineInspectionService.timelineWords(project: project)
        #expect(timed.first?.at == 1)
        #expect(timed.first?.end == 1.5)
        #expect(project.captionCues.first?.timelineEnd ?? 99 < 1.8)
        let trimmed = TimelineClipGeometry.trimmed(clip: clip, edge: .leading, translationX: 100,
            contentWidth: 400, projectDuration: 4, mediaDuration: 30)
        #expect(trimmed.sourceStart == 12)
        #expect(trimmed.duration == 3)
        let split = project.split(clipID: clip.id, atTimelineTime: 2)
        #expect(split)
        #expect(project.clips.map(\.sourceDuration) == [4, 4])
        #expect(project.clips.map(\.duration) == [2, 2])
        #expect(project.clips.allSatisfy { $0.resolvedPlaybackRate == 2 })
        let decoded = try JSONDecoder().decode(TimelineClip.self, from: JSONEncoder().encode(clip))
        #expect(decoded == clip)
        var json = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(clip)) as? [String: Any])
        json.removeValue(forKey: "playbackRate")
        let legacy = try JSONDecoder().decode(TimelineClip.self, from: JSONSerialization.data(withJSONObject: json))
        #expect(legacy.resolvedPlaybackRate == 1)
        #expect(legacy.duration == 8)
        #expect(ClipSpeed.normalized(.nan) == 1)
        #expect(ClipSpeed.normalized(0) == 1)
    }

    @Test func applyToAllSkipsLocksRetimesCaptionsAndUndoesAsOneEdit() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "speed-all-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let url = root.appending(path: "base.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 6, to: url)
        let session = EditorSession(store: SpeedTestStore())
        await session.importMedia([url])
        let media = try #require(session.project.media.first)
        let first = TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 2)
        let locked = TimelineClip(mediaID: media.id, sourceStart: 2, sourceEnd: 4, isLocked: true)
        let last = TimelineClip(mediaID: media.id, sourceStart: 4, sourceEnd: 6)
        session.updateProject { project in
            project.clips = [first, locked, last]
            project.transcript = [TranscriptWord(mediaID: media.id, text: "later", start: 4.4, end: 4.8)]
            project.captionsEnabled = true
        }
        let previous = session.project
        #expect(await session.setClipSpeed(2, applyToAll: true))
        #expect(session.project.clips.map(\.resolvedPlaybackRate) == [2, 1, 2])
        #expect(session.project.clips[1] == locked)
        #expect(session.project.duration == 4)
        #expect(abs((session.project.timelineTime(for: previous.transcript![0]) ?? 0) - 3.2) < 0.001)
        #expect(session.statusMessage.contains("1 locked skipped"))
        await session.undo()
        #expect(session.project == previous)
        session.player.replaceCurrentItem(with: nil)
    }

    @Test func exportedFastAndSlowClipsKeepTheirOriginalAudioPitch() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "speed-pitch-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let video = root.appending(path: "silent.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 160, height: 90), seconds: 6, to: video)
        let audio = root.appending(path: "tone.wav")
        try writeTone(to: audio)
        let sourceURL = root.appending(path: "source.mov")
        let composition = AVMutableComposition()
        let videoAsset = AVURLAsset(url: video)
        let audioAsset = AVURLAsset(url: audio)
        let videoTrack = try #require(try await videoAsset.loadTracks(withMediaType: .video).first)
        let audioTrack = try #require(try await audioAsset.loadTracks(withMediaType: .audio).first)
        let range = CMTimeRange(start: .zero, duration: CMTime(seconds: 6, preferredTimescale: 600))
        try composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)?.insertTimeRange(range, of: videoTrack, at: .zero)
        try composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)?.insertTimeRange(range, of: audioTrack, at: .zero)
        let mux = try #require(AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetHighestQuality))
        mux.outputURL = sourceURL
        mux.outputFileType = .mov
        await mux.export()
        #expect(mux.status == .completed)
        let media = try await MediaProbe.inspect(url: sourceURL)
        let project = EditorProject(media: [media], clips: [
            TimelineClip(mediaID: media.id, sourceStart: 0, sourceEnd: 2, playbackRate: 2),
            TimelineClip(mediaID: media.id, sourceStart: 2, sourceEnd: 4, playbackRate: 0.5),
            TimelineClip(mediaID: media.id, sourceStart: 4, sourceEnd: 6, playbackRate: 1.25),
        ])
        let built = try await CompositionBuilder.build(project: project)
        #expect(abs(built.asset.duration.seconds - 6.6) < 0.02)
        #expect(built.audioMix?.inputParameters.first?.audioTimePitchAlgorithm == .spectral)
        #expect(built.playerItem.audioTimePitchAlgorithm == .spectral)
        let output = root.appending(path: "retimed.mp4")
        try await ExportService.export(project: project, to: output)
        let asset = AVURLAsset(url: output)
        #expect(abs(try await asset.load(.duration).seconds - 6.6) < 0.06)
        let samples = try await readAudio(asset)
        for window in [0.2...0.8, 1.3...4.7, 5.3...6.3] {
            let start = Int(window.lowerBound * 48000), end = min(samples.count, Int(window.upperBound * 48000))
            #expect(end > start)
            let crossings = (start + 1..<end).count { samples[$0 - 1] <= 0 && samples[$0] > 0 }
            let frequency = Double(crossings) / (Double(end - start) / 48000)
            #expect(abs(frequency - 220) < 3, "Pitch was \(frequency) Hz in \(window); expected 220 Hz")
        }
    }

    private func writeTone(to url: URL) throws {
        let format = try #require(AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1))
        let buffer = try #require(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 48000 * 6))
        buffer.frameLength = buffer.frameCapacity
        let samples = try #require(buffer.floatChannelData?[0])
        for index in 0..<Int(buffer.frameLength) {
            samples[index] = Float(0.4 * sin(2 * .pi * 220 * Double(index) / 48000))
        }
        let file = try AVAudioFile(forWriting: url, settings: format.settings)
        try file.write(from: buffer)
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
            let status = values.withUnsafeMutableBytes { bytes in
                CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: bytes.count, destination: bytes.baseAddress!)
            }
            #expect(status == kCMBlockBufferNoErr)
            samples += values
        }
        #expect(reader.status == .completed)
        return samples
    }
}
