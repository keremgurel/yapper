@preconcurrency import AVFoundation
import Foundation

struct SoundEffectDescriptor: Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let detail: String
    let icon: String
    let duration: Double

    static let library: [SoundEffectDescriptor] = [
        .init(id: "pop", name: "Pop", detail: "Bright accent", icon: "circle.fill", duration: 0.22),
        .init(id: "mouse-click", name: "Mouse click", detail: "Clean UI click", icon: "cursorarrow.click.2", duration: 0.16),
        .init(id: "camera-shutter", name: "Camera shutter", detail: "Fast camera snap", icon: "camera", duration: 0.42),
        .init(id: "whoosh", name: "Whoosh", detail: "Smooth transition", icon: "wind", duration: 0.82),
        .init(id: "mechanical-keyboard", name: "Mechanical keys", detail: "5 seconds of typing", icon: "keyboard", duration: 5),
        .init(id: "notification", name: "Notification", detail: "Friendly chime", icon: "bell", duration: 0.92),
        .init(id: "soft-tap", name: "Soft tap", detail: "Subtle emphasis", icon: "hand.tap", duration: 0.2),
        .init(id: "success-ding", name: "Success ding", detail: "Positive two-note cue", icon: "checkmark.circle", duration: 1.2),
        .init(id: "page-swipe", name: "Page swipe", detail: "Quick motion texture", icon: "rectangle.portrait.and.arrow.forward", duration: 0.62),
        .init(id: "bass-hit", name: "Bass hit", detail: "Deep impact", icon: "speaker.wave.3", duration: 0.72),
    ]
}

actor SoundEffectService {
    static let shared = SoundEffectService()
    static let sampleRate = 48_000.0

    func fileURL(for effect: SoundEffectDescriptor) throws -> URL {
        let folder = try libraryFolder()
        let url = folder.appending(path: "\(effect.id).wav")
        if FileManager.default.fileExists(atPath: url.path) { return url }
        try Self.write(Self.render(effect), to: url)
        return url
    }

    func duration(of url: URL) async throws -> Double {
        let asset = AVURLAsset(url: url)
        guard try await asset.loadTracks(withMediaType: .audio).first != nil else {
            throw NativeEditorError.noAudioTrack(url.lastPathComponent)
        }
        return try await asset.load(.duration).seconds
    }

    nonisolated static func render(_ effect: SoundEffectDescriptor) -> [Float] {
        let count = max(1, Int((effect.duration * sampleRate).rounded()))
        var samples = [Float](repeating: 0, count: count)
        var filteredNoise = 0.0

        for index in samples.indices {
            let time = Double(index) / sampleRate
            let progress = time / effect.duration
            let rawNoise = noise(index, seed: effect.id.hashValue)
            filteredNoise += (rawNoise - filteredNoise) * 0.065
            let value: Double
            switch effect.id {
            case "pop":
                let sweep = 620 - 430 * progress
                value = sin(2 * .pi * sweep * time) * exp(-17 * time)
                    + rawNoise * exp(-75 * time) * 0.42
            case "mouse-click":
                value = click(at: time, onset: 0, frequency: 2_600, decay: 120)
                    + click(at: time, onset: 0.055, frequency: 2_000, decay: 145) * 0.72
            case "camera-shutter":
                value = click(at: time, onset: 0, frequency: 1_850, decay: 75)
                    + click(at: time, onset: 0.052, frequency: 1_200, decay: 62) * 0.8
                    + click(at: time, onset: 0.145, frequency: 2_250, decay: 82) * 0.65
                    + rawNoise * envelope(time, onset: 0.04, decay: 19) * 0.34
            case "whoosh":
                let shape = pow(sin(.pi * min(1, max(0, progress))), 1.35)
                value = filteredNoise * shape * 1.8
                    + sin(2 * .pi * (170 + 480 * progress) * time) * shape * 0.12
            case "mechanical-keyboard":
                let interval = 0.092
                let key = Int(time / interval)
                let phase = time - Double(key) * interval
                let keyPitch = 1_450 + Double((key * 83) % 850)
                let keyNoise = noise(index, seed: key * 971)
                value = sin(2 * .pi * keyPitch * phase) * exp(-105 * phase) * 0.78
                    + keyNoise * exp(-145 * phase) * 0.3
            case "notification":
                value = tone(time, onset: 0, frequency: 740, decay: 4.8)
                    + tone(time, onset: 0.13, frequency: 1_110, decay: 4.2) * 0.72
            case "soft-tap":
                value = sin(2 * .pi * 180 * time) * exp(-26 * time)
                    + filteredNoise * exp(-58 * time) * 0.55
            case "success-ding":
                value = tone(time, onset: 0, frequency: 659.25, decay: 3.9) * 0.68
                    + tone(time, onset: 0.18, frequency: 987.77, decay: 3.2)
            case "page-swipe":
                let shape = pow(sin(.pi * min(1, max(0, progress))), 0.85)
                value = filteredNoise * shape * 1.4
                    + rawNoise * shape * 0.12
            case "bass-hit":
                let frequency = 104 - 58 * progress
                value = sin(2 * .pi * frequency * time) * exp(-5.4 * time)
                    + filteredNoise * exp(-14 * time) * 0.34
            default:
                value = 0
            }
            samples[index] = Float(value)
        }

        let peak = max(0.001, samples.map { abs($0) }.max() ?? 1)
        let gain = 0.86 / peak
        return samples.map { $0 * gain }
    }

    private func libraryFolder() throws -> URL {
        let root = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let folder = root
            .appending(path: "Yapper Studio Native", directoryHint: .isDirectory)
            .appending(path: "Sound Effects", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    private nonisolated static func write(_ samples: [Float], to url: URL) throws {
        guard let format = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: sampleRate,
            channels: 1,
            interleaved: false
        ), let buffer = AVAudioPCMBuffer(
            pcmFormat: format,
            frameCapacity: AVAudioFrameCount(samples.count)
        ), let channel = buffer.floatChannelData?[0]
        else {
            throw NativeEditorError.cannotCreateTrack("sound effect")
        }
        buffer.frameLength = AVAudioFrameCount(samples.count)
        for index in samples.indices { channel[index] = samples[index] }
        let file = try AVAudioFile(forWriting: url, settings: format.settings)
        try file.write(from: buffer)
    }

    private nonisolated static func noise(_ index: Int, seed: Int) -> Double {
        var value = UInt64(bitPattern: Int64(index &* 1_103_515_245 &+ seed))
        value ^= value >> 13
        value &*= 0x5DEECE66D
        value ^= value >> 17
        return Double(value & 0xFFFF) / 32_767.5 - 1
    }

    private nonisolated static func envelope(_ time: Double, onset: Double, decay: Double) -> Double {
        guard time >= onset else { return 0 }
        return exp(-(time - onset) * decay)
    }

    private nonisolated static func click(
        at time: Double,
        onset: Double,
        frequency: Double,
        decay: Double
    ) -> Double {
        guard time >= onset else { return 0 }
        let local = time - onset
        return sin(2 * .pi * frequency * local) * exp(-decay * local)
    }

    private nonisolated static func tone(
        _ time: Double,
        onset: Double,
        frequency: Double,
        decay: Double
    ) -> Double {
        guard time >= onset else { return 0 }
        let local = time - onset
        return (
            sin(2 * .pi * frequency * local)
                + sin(2 * .pi * frequency * 2 * local) * 0.22
        ) * exp(-decay * local)
    }
}
