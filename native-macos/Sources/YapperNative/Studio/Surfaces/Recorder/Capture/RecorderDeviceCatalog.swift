@preconcurrency import AVFoundation

/// A camera or microphone the creator can choose.
struct RecorderDevice: Identifiable, Hashable {
    let id: String
    let name: String
}

/// The cameras and microphones attached right now, kept current as devices
/// are plugged in and out.
@MainActor
final class RecorderDeviceCatalog: ObservableObject {
    @Published private(set) var cameras: [RecorderDevice] = []
    @Published private(set) var microphones: [RecorderDevice] = []

    private var observers: [NSObjectProtocol] = []

    init() {
        reload()
        let center = NotificationCenter.default
        for name in [AVCaptureDevice.wasConnectedNotification, AVCaptureDevice.wasDisconnectedNotification] {
            observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.reload() }
            })
        }
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
    }

    func reload() {
        cameras = Self.discover(
            [.builtInWideAngleCamera, .external, .continuityCamera, .deskViewCamera],
            media: .video
        )
        microphones = Self.discover([.microphone, .external], media: .audio)
    }

    private static func discover(_ types: [AVCaptureDevice.DeviceType], media: AVMediaType) -> [RecorderDevice] {
        AVCaptureDevice.DiscoverySession(deviceTypes: types, mediaType: media, position: .unspecified)
            .devices
            .map { RecorderDevice(id: $0.uniqueID, name: $0.localizedName) }
    }
}
