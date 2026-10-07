import Foundation

/// Per-sound starting levels on this Mac. Timeline layers copy the value on
/// insertion, so later preference changes never remix an existing project.
@MainActor
final class AudioLibraryVolumes: ObservableObject {
    static let shared = AudioLibraryVolumes(defaults: ProjectStore.isTesting
        ? UserDefaults(suiteName: "AudioLibraryVolumes-tests-\(ProcessInfo.processInfo.processIdentifier)")!
        : .standard)

    static let key = "audioLibraryDefaultVolumes"
    @Published private(set) var levels: [String: Double]
    private let defaults: UserDefaults

    init(defaults: UserDefaults) {
        self.defaults = defaults
        levels = (defaults.dictionary(forKey: Self.key) ?? [:]).compactMapValues {
            guard let number = $0 as? NSNumber else { return nil }
            return Self.clamped(number.doubleValue)
        }
    }

    func volume(for id: String) -> Double {
        levels[canonicalID(id)] ?? 1
    }

    func setVolume(_ volume: Double, for id: String) {
        let id = canonicalID(id)
        let value = Self.clamped(volume)
        guard levels[id] != value else { return }
        levels[id] = value
        defaults.set(levels, forKey: Self.key)
    }

    private func canonicalID(_ id: String) -> String {
        SoundEffectDescriptor.effect(id: id)?.id ?? id
    }

    /// Library auditioning and defaults range from silent to original volume.
    /// A particular timeline clip can still be amplified with its own fader.
    private static func clamped(_ volume: Double) -> Double {
        min(1, AudioLevel.clamped(volume))
    }
}
