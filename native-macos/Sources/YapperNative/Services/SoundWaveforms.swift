@preconcurrency import AVFoundation
import Foundation

/// The shape of each shipped sound effect, worked out once from its file, for
/// the waveform a card shows and scrubs.
@MainActor
final class SoundWaveforms: ObservableObject {
    static let shared = SoundWaveforms()
    nonisolated static let bars = 40

    @Published private(set) var peaks: [String: [Float]] = [:]
    private var loading: Set<String> = []

    func load(_ effect: SoundEffectDescriptor) {
        guard peaks[effect.id] == nil, !loading.contains(effect.id) else { return }
        loading.insert(effect.id)
        Task.detached(priority: .utility) {
            guard let url = try? await SoundEffectService.shared.fileURL(for: effect) else { return }
            let values = Self.read(url)
            await MainActor.run {
                self.peaks[effect.id] = values
                self.loading.remove(effect.id)
            }
        }
    }

    /// Loudest sample in each of `bars` slices, scaled so the loudest slice is 1.
    nonisolated static func read(_ url: URL) -> [Float] {
        guard let file = try? AVAudioFile(forReading: url),
              let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)),
              (try? file.read(into: buffer)) != nil,
              let channel = buffer.floatChannelData?[0] else { return Array(repeating: 0.3, count: bars) }
        let count = Int(buffer.frameLength)
        guard count > 0 else { return Array(repeating: 0.3, count: bars) }
        let slice = max(1, count / bars)
        var values: [Float] = []
        for bar in 0..<bars {
            let start = bar * slice
            let end = min(count, start + slice)
            var peak: Float = 0
            if start < end { for i in start..<end { peak = max(peak, abs(channel[i])) } }
            values.append(peak)
        }
        let loudest = max(values.max() ?? 1, 0.0001)
        return values.map { max(0.06, $0 / loudest) }
    }
}
