@preconcurrency import AVFoundation

/// The live camera and microphone: which devices feed the session, whether
/// each is on, and the session running behind the preview.
///
/// All session changes run on one serial queue, as AVFoundation asks; the
/// published state is what the page reads.
@MainActor
final class RecorderCaptureSession: ObservableObject {
    let session = AVCaptureSession()
    let movie = RecorderMovieOutput()

    @Published private(set) var cameraOn = true
    @Published private(set) var micOn = true
    @Published private(set) var cameraID: String?
    @Published private(set) var micID: String?
    @Published private(set) var running = false
    @Published private(set) var problem: String?

    /// Something to record: a camera, a microphone, or both.
    var canRecord: Bool { (cameraOn && cameraID != nil) || (micOn && micID != nil) }

    private let queue = DispatchQueue(label: "app.yapper.recorder.session")
    private var runtimeObserver: NSObjectProtocol?
    private var lastAccess: RecorderAccess?

    init() {
        runtimeObserver = NotificationCenter.default.addObserver(
            forName: AVCaptureSession.runtimeErrorNotification, object: session, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.problem = "The camera stopped unexpectedly. Turn it off and on again, or pick another camera."
            }
        }
    }

    deinit {
        if let runtimeObserver { NotificationCenter.default.removeObserver(runtimeObserver) }
    }

    /// Starts the preview with the chosen devices, or the defaults. Safe to
    /// call again (on return from System Settings): it only rebuilds when
    /// something changed, and never during a take.
    func start(access: RecorderAccess, cameras: [RecorderDevice], microphones: [RecorderDevice]) {
        guard !movie.isRecording, movie.phase != .finishing else { return }
        var changed = !running
        if cameraID == nil || !cameras.contains(where: { $0.id == cameraID }) {
            cameraID = AVCaptureDevice.default(for: .video)?.uniqueID ?? cameras.first?.id
            changed = true
        }
        if micID == nil || !microphones.contains(where: { $0.id == micID }) {
            micID = AVCaptureDevice.default(for: .audio)?.uniqueID ?? microphones.first?.id
            changed = true
        }
        if access != lastAccess {
            cameraOn = access.camera
            micOn = access.microphone
            lastAccess = access
            changed = true
        }
        if changed { apply() }
    }

    func stop() {
        let session = session
        queue.async { if session.isRunning { session.stopRunning() } }
        running = false
    }

    func toggleCamera() { cameraOn.toggle(); apply() }
    func toggleMic() { micOn.toggle(); apply() }

    func selectCamera(_ id: String) { cameraID = id; cameraOn = true; apply() }
    func selectMic(_ id: String) { micID = id; micOn = true; apply() }

    /// Rebuilds the inputs to match the published state.
    private func apply() {
        problem = nil
        let session = session
        let output = movie.output
        let video = cameraOn ? cameraID : nil
        let audio = micOn ? micID : nil
        queue.async { [weak self] in
            let failure = Self.configure(session, output: output, videoID: video, audioID: audio)
            if !session.isRunning { session.startRunning() }
            let isRunning = session.isRunning
            Task { @MainActor in
                self?.running = isRunning
                if let failure { self?.problem = failure }
            }
        }
    }

    private nonisolated static func configure(
        _ session: AVCaptureSession, output: AVCaptureMovieFileOutput, videoID: String?, audioID: String?
    ) -> String? {
        session.beginConfiguration()
        defer { session.commitConfiguration() }
        if session.canSetSessionPreset(.high) { session.sessionPreset = .high }
        session.inputs.forEach(session.removeInput)
        var failure: String?
        if let videoID {
            if !add(videoID, to: session) {
                failure = "That camera couldn't be opened. It may be in use by another app."
            }
        }
        if let audioID {
            if !add(audioID, to: session) {
                failure = failure ?? "That microphone couldn't be opened. It may be in use by another app."
            }
        }
        if !session.outputs.contains(output), session.canAddOutput(output) {
            session.addOutput(output)
        }
        return failure
    }

    private nonisolated static func add(_ id: String, to session: AVCaptureSession) -> Bool {
        guard let device = AVCaptureDevice(uniqueID: id),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else { return false }
        session.addInput(input)
        return true
    }
}

/// Which of camera and microphone the creator allowed.
struct RecorderAccess: Equatable {
    var camera: Bool
    var microphone: Bool
}
