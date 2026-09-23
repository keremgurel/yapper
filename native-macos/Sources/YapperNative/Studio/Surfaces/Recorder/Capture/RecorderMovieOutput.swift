@preconcurrency import AVFoundation

/// Writes one take to a temporary movie file: start, pause, resume, stop.
@MainActor
final class RecorderMovieOutput: NSObject, ObservableObject {
    enum Phase: Equatable { case idle, recording, paused, finishing }

    let output = AVCaptureMovieFileOutput()
    @Published private(set) var phase: Phase = .idle
    @Published private(set) var failure: String?

    private var finished: CheckedContinuation<URL?, Never>?

    var isRecording: Bool { phase == .recording || phase == .paused }

    /// Seconds recorded so far, pauses excluded.
    var recordedSeconds: Double {
        let duration = output.recordedDuration
        return duration.isValid ? max(0, duration.seconds) : 0
    }

    /// Input level of the microphone, 0 to 1, for the meter.
    var audioLevel: Double {
        guard let channels = output.connection(with: .audio)?.audioChannels, !channels.isEmpty else { return 0 }
        let decibels = channels.map { Double($0.averagePowerLevel) }.max() ?? -160
        // Speech sits roughly between -50 dB and 0 dB.
        return min(1, max(0, (decibels + 50) / 50))
    }

    func start() {
        guard phase == .idle else { return }
        failure = nil
        if let connection = output.connection(with: .video) {
            output.setOutputSettings([AVVideoCodecKey: AVVideoCodecType.h264], for: connection)
        }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("yapper-take-\(UUID().uuidString)")
            .appendingPathExtension("mov")
        output.startRecording(to: url, recordingDelegate: self)
        phase = .recording
    }

    func pause() {
        guard phase == .recording else { return }
        output.pauseRecording()
        phase = .paused
    }

    func resume() {
        guard phase == .paused else { return }
        output.resumeRecording()
        phase = .recording
    }

    /// Ends the take and hands back its file, or nil when nothing usable
    /// was written.
    func stop() async -> URL? {
        guard isRecording else { return nil }
        phase = .finishing
        return await withCheckedContinuation { continuation in
            finished = continuation
            output.stopRecording()
        }
    }

    private func complete(_ url: URL?, error: String?) {
        phase = .idle
        failure = error
        finished?.resume(returning: url)
        finished = nil
    }
}

extension RecorderMovieOutput: AVCaptureFileOutputRecordingDelegate {
    nonisolated func fileOutput(
        _ output: AVCaptureFileOutput,
        didFinishRecordingTo outputFileURL: URL,
        from connections: [AVCaptureConnection],
        error: Error?
    ) {
        // A recording can end with an error and still be a complete file,
        // for example when the disk fills just after the last frame.
        let finishedCleanly = (error as NSError?)?
            .userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool ?? (error == nil)
        let exists = FileManager.default.fileExists(atPath: outputFileURL.path)
        Task { @MainActor in
            if finishedCleanly, exists {
                self.complete(outputFileURL, error: nil)
            } else {
                self.complete(nil, error: "The take couldn't be saved. Check your disk space and record again.")
            }
        }
    }
}
