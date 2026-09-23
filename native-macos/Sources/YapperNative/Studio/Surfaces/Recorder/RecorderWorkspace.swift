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
    let saving = RecorderSaveState()
    let prompter = TeleprompterSettingsStore()
    let script = RecorderScriptStore.shared

    private init() {
        flow = RecorderTakeFlow(movie: capture.movie)
    }
}

/// The teleprompter's look and pace for this app session.
@MainActor
final class TeleprompterSettingsStore: ObservableObject {
    @Published var settings = TeleprompterSettings()
}
