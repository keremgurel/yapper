import AppKit
import AVFoundation

/// The composer's dictation: start, stop and transcribe, or cancel. Lives
/// outside the composer view so a take keeps going while the composer grows
/// to the full window and back.
@MainActor
final class DictationController: ObservableObject {
    static let shared = DictationController()

    enum Phase { case idle, recording, transcribing }

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var error: String?
    @Published private(set) var permissionBlocked = false
    @Published private(set) var seconds = 0
    /// Recent levels, oldest first, for the waveform.
    @Published private(set) var levels: [Double] = []

    static let levelCount = 64
    private let recorder = DictationRecorder()
    private var ticker: Timer?
    private var startedAt = Date()

    var recording: Bool { phase == .recording }
    var transcribing: Bool { phase == .transcribing }

    /// Access was refused before; only System Settings can change that.
    var microphoneDenied: Bool {
        let status = AVCaptureDevice.authorizationStatus(for: .audio)
        return status == .denied || status == .restricted
    }

    func start() async {
        guard phase == .idle else { return }
        error = nil
        permissionBlocked = false
        guard await microphoneAllowed() else {
            error = "Microphone access is off."
            permissionBlocked = true
            return
        }
        do {
            try recorder.start()
        } catch {
            self.error = "Couldn't start the microphone."
            return
        }
        startedAt = Date()
        seconds = 0
        levels = Array(repeating: 0, count: Self.levelCount)
        phase = .recording
        ticker = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    /// Stops the take and returns what was heard, or nil when nothing was
    /// (a failed or silent take), so the caller leaves the draft alone.
    func stop() async -> String? {
        guard phase == .recording else { return nil }
        stopTicking()
        guard let file = recorder.stop() else { phase = .idle; return nil }
        phase = .transcribing
        defer { phase = .idle }
        do {
            let words = try await DictationTranscriber.transcribe(file)
            return words.isEmpty ? nil : words
        } catch {
            self.error = "Couldn't transcribe."
            return nil
        }
    }

    func cancel() {
        guard phase == .recording else { return }
        stopTicking()
        recorder.discard()
        phase = .idle
    }

    func openMicrophoneSettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone") {
            NSWorkspace.shared.open(url)
        }
    }

    private func tick() {
        guard phase == .recording else { return }
        seconds = Int(Date().timeIntervalSince(startedAt))
        levels.append(recorder.level())
        if levels.count > Self.levelCount { levels.removeFirst(levels.count - Self.levelCount) }
    }

    private func stopTicking() {
        ticker?.invalidate()
        ticker = nil
    }

    private func microphoneAllowed() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: return true
        case .notDetermined: return await AVCaptureDevice.requestAccess(for: .audio)
        default: return false
        }
    }
}
