import Foundation

/// The shape of every sound on the audio track.
///
/// Published on its own, like the playhead and the drag: peaks arriving for a
/// sound effect are of no interest to the player, the canvas or the transcript,
/// and putting them on the session meant every one of them rebuilt when a
/// waveform finished decoding.
///
/// Keyed by file. A whoosh dropped in twelve places is one entry, decoded once.
@MainActor
final class AudioWaveformStore: ObservableObject {
    @Published private(set) var peaksByFile: [String: [Float]] = [:]

    private let service: WaveformService
    /// Files already being measured, so a lane full of cells asking at the same
    /// moment starts one decode between them rather than one each.
    private var inFlight: Set<String> = []

    init(service: WaveformService) {
        self.service = service
    }

    func peaks(for layer: ProjectAudioLayer) -> [Float] {
        peaksByFile[WaveformSource(audio: layer).key] ?? []
    }

    /// Asked for by the cell that needs it, rather than pushed when audio is
    /// added: undo, a reopened project and an import all put layers on the
    /// track, and a cell that draws is a cell that wants its waveform.
    func load(for layer: ProjectAudioLayer) async {
        let source = WaveformSource(audio: layer)
        guard peaksByFile[source.key] == nil, !inFlight.contains(source.key) else { return }
        inFlight.insert(source.key)
        defer { inFlight.remove(source.key) }
        // A sound effect is seconds long, not minutes. Fewer bins than a
        // recording gets is still far more detail than a cell this size can
        // draw, and it keeps a dozen of them off the decoder.
        let bins = max(600, min(6_000, Int(ceil(source.duration * 240))))
        do {
            let peaks = try await service.peaks(for: source, targetBins: bins) { [weak self] peaks, _ in
                // Shown as it arrives, so a long import is not a blank cell.
                self?.peaksByFile[source.key] = peaks
            }
            peaksByFile[source.key] = peaks
        } catch {
            // A cell without a waveform is still a cell you can drag; there is
            // nothing here worth interrupting an edit for.
            peaksByFile.removeValue(forKey: source.key)
        }
    }

    func invalidate(_ layer: ProjectAudioLayer) async {
        let source = WaveformSource(audio: layer)
        peaksByFile.removeValue(forKey: source.key)
        await service.invalidate(source)
    }
}
