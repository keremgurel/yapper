import Foundation

/// The Recorder's long-lived parts, kept for the life of the app so leaving
/// the tab mid-review does not throw a take away. Each part owns one concern;
/// this only holds them together.
@MainActor
final class RecorderWorkspace {
    static let shared = RecorderWorkspace()

    let permissions = RecorderPermissions()
    let devices = RecorderDeviceCatalog()
    let capture = RecorderCaptureSession()
    let flow: RecorderTakeFlow
    let prompter = TeleprompterSettingsStore()
    let script = RecorderScriptStore.shared

    private init() {
        flow = RecorderTakeFlow(movie: capture.movie)
    }
}

/// The teleprompter's look, layout and pace, restored between launches.
@MainActor
final class TeleprompterSettingsStore: ObservableObject {
    private let defaults: UserDefaults
    @Published var settings: TeleprompterSettings {
        didSet {
            if let data = try? JSONEncoder().encode(settings) {
                defaults.set(data, forKey: "recorder.prompter.settings")
            }
        }
    }
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        settings = defaults.data(forKey: "recorder.prompter.settings")
            .flatMap { try? JSONDecoder().decode(TeleprompterSettings.self, from: $0) } ?? TeleprompterSettings()
    }
}
