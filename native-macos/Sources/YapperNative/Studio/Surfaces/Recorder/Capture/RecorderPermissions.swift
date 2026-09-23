import AppKit
@preconcurrency import AVFoundation

/// Camera and microphone access for the Recorder.
@MainActor
final class RecorderPermissions: ObservableObject {
    enum Access: Equatable { case unknown, granted, denied }

    @Published private(set) var camera: Access = RecorderPermissions.access(for: .video)
    @Published private(set) var microphone: Access = RecorderPermissions.access(for: .audio)

    /// Nothing to record with: both were refused.
    var blocked: Bool { camera == .denied && microphone == .denied }

    /// Asks for whichever of the two has not been answered yet. The system
    /// shows its prompt once; after that the answer lives in System Settings.
    func request() async {
        if camera == .unknown {
            camera = await AVCaptureDevice.requestAccess(for: .video) ? .granted : .denied
        }
        if microphone == .unknown {
            microphone = await AVCaptureDevice.requestAccess(for: .audio) ? .granted : .denied
        }
    }

    /// Re-reads the answers, for when the creator comes back from Settings.
    func refresh() {
        camera = Self.access(for: .video)
        microphone = Self.access(for: .audio)
    }

    func openSettings(for media: AVMediaType) {
        let pane = media == .video ? "Privacy_Camera" : "Privacy_Microphone"
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?\(pane)") {
            NSWorkspace.shared.open(url)
        }
    }

    private static func access(for media: AVMediaType) -> Access {
        switch AVCaptureDevice.authorizationStatus(for: media) {
        case .authorized: .granted
        case .notDetermined: .unknown
        default: .denied
        }
    }
}
