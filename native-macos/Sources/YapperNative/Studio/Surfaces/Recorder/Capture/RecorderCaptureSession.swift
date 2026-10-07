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
    @Published private(set) var configuring = false
    @Published private(set) var cameraReady = false
    @Published private(set) var micReady = false
    @Published private(set) var sourceRatio: Double = 16.0 / 9
    private var configurationID = UUID()
    @Published private(set) var problem: String?

    /// Something to record: a camera, a microphone, or both.
    var canRecord: Bool { running && !configuring && (cameraReady || micReady) }
    var readiness: String {
        if configuring { return "Starting camera and microphone…" }
        if let problem { return problem }
        if canRecord { return cameraReady ? "Ready to record" : "Audio only. Download your take after recording; the video editor requires a camera." }
        return "Choose an available camera or microphone, then retry."
    }
    func retry() {
        if cameraID == nil { cameraID = AVCaptureDevice.default(for: .video)?.uniqueID }
        if micID == nil { micID = AVCaptureDevice.default(for: .audio)?.uniqueID }
        apply()
    }

    private let queue = DispatchQueue(label: "app.yapper.recorder.session")
    private var runtimeObserver: NSObjectProtocol?
    private var lastAccess: RecorderAccess?

    init() {
        runtimeObserver = NotificationCenter.default.addObserver(
            forName: AVCaptureSession.runtimeErrorNotification, object: session, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.running = false
                self?.problem = "Capture stopped. Retry the devices or choose another camera or microphone."
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
        configurationID = UUID()
        configuring = false
        running = false
        cameraReady = false
        micReady = false
    }

    func toggleCamera() { cameraOn.toggle(); apply() }
    func toggleMic() { micOn.toggle(); apply() }

    func selectCamera(_ id: String) { cameraID = id; cameraOn = true; apply() }
    func selectMic(_ id: String) { micID = id; micOn = true; apply() }

    /// Rebuilds the inputs to match the published state.
    private func apply() {
        problem = nil
        configuring = true
        cameraReady = false
        micReady = false
        let requestID = UUID()
        configurationID = requestID
        let session = session
        let output = movie.output
        let video = cameraOn ? cameraID : nil
        let audio = micOn ? micID : nil
        queue.async { [weak self] in
            let failure = Self.configure(session, output: output, videoID: video, audioID: audio)
            if !session.isRunning { session.startRunning() }
            let isRunning = session.isRunning
            let videoReady = output.connection(with: .video) != nil
            let audioReady = output.connection(with: .audio) != nil
            let device = session.inputs.compactMap { $0 as? AVCaptureDeviceInput }
                .first { $0.device.hasMediaType(.video) }?.device
            let dimensions = device.map { CMVideoFormatDescriptionGetDimensions($0.activeFormat.formatDescription) }
            let ratio = dimensions.map { Double($0.width) / Double(max(1, $0.height)) } ?? 16.0 / 9
            Task { @MainActor in
                guard let self, self.configurationID == requestID else { return }
                self.running = isRunning
                self.configuring = false
                self.cameraReady = videoReady
                self.micReady = audioReady
                self.sourceRatio = ratio
                self.problem = failure ?? (isRunning && (videoReady || audioReady) ? nil : "No capture device is ready. Check access and retry.")
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
