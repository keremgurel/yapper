import AVFoundation

/// One voice take from the default microphone, written to a temporary AAC
/// file at a bitrate the transcriber hears cleanly.
@MainActor
final class DictationRecorder {
    private var recorder: AVAudioRecorder?
    private(set) var fileURL: URL?

    var isRecording: Bool { recorder?.isRecording ?? false }

    func start() throws {
        let url = FileManager.default.temporaryDirectory.appending(path: "yapper-dictation-\(UUID().uuidString).m4a")
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            // Well above the 64 kbps line where recognition starts to drop words.
            AVEncoderBitRateKey: 96_000,
        ]
        let recorder = try AVAudioRecorder(url: url, settings: settings)
        recorder.isMeteringEnabled = true
        guard recorder.record() else { throw DictationError.couldNotStart }
        self.recorder = recorder
        fileURL = url
    }

    /// The level right now, 0 to 1, for the waveform.
    func level() -> Double {
        guard let recorder, recorder.isRecording else { return 0 }
        recorder.updateMeters()
        let power = Double(recorder.averagePower(forChannel: 0))
        // -50 dB and below is silence; 0 dB is as loud as it gets.
        return min(1, max(0, (power + 50) / 50))
    }

    /// Stops and hands back the finished file.
    func stop() -> URL? {
        recorder?.stop()
        recorder = nil
        return fileURL
    }

    /// Stops and throws the take away.
    func discard() {
        recorder?.stop()
        recorder = nil
        if let fileURL { try? FileManager.default.removeItem(at: fileURL) }
        fileURL = nil
    }
}

enum DictationError: Error {
    case couldNotStart
    case transcribeFailed
}
