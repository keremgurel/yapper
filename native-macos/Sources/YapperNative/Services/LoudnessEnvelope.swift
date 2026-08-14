@preconcurrency import AVFoundation
import Foundation

/// How loud a recording is, moment by moment.
///
/// Read straight off the file rather than off the transcript, because the
/// transcript is a poor witness to silence: a word's end is where it stops
/// being a word, not where the sound stops. One pass, mono-mixed, at a fixed
/// hop, which is all `SilenceScan` needs.
enum LoudnessEnvelope {
    struct Envelope: Sendable {
        /// RMS per frame, in dBFS.
        let loudness: [Double]
        /// Seconds per frame.
        let hop: Double
    }

    /// - Parameter hop: frame length in seconds. 20ms is fine enough to find
    ///   the edge of a word and coarse enough to stay cheap on a long take.
    static func measure(url: URL, hop: Double = 0.02) throws -> Envelope {
        let file = try AVAudioFile(
            forReading: url,
            commonFormat: .pcmFormatFloat32,
            interleaved: false
        )
        let format = file.processingFormat
        let channels = Int(format.channelCount)
        guard channels > 0, format.sampleRate > 0 else {
            return Envelope(loudness: [], hop: hop)
        }
        let framesPerHop = max(1, Int(format.sampleRate * hop))
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 32_768) else {
            return Envelope(loudness: [], hop: hop)
        }

        var loudness: [Double] = []
        var sumOfSquares = 0.0
        var counted = 0

        while file.framePosition < file.length {
            try Task.checkCancellation()
            buffer.frameLength = 0
            try file.read(into: buffer, frameCount: buffer.frameCapacity)
            let frames = Int(buffer.frameLength)
            guard frames > 0, let data = buffer.floatChannelData else { break }

            for frame in 0 ..< frames {
                var sample = 0.0
                for channel in 0 ..< channels {
                    sample += Double(data[channel][frame])
                }
                sample /= Double(channels)
                sumOfSquares += sample * sample
                counted += 1
                if counted == framesPerHop {
                    loudness.append(decibels(fromMeanSquare: sumOfSquares / Double(counted)))
                    sumOfSquares = 0
                    counted = 0
                }
            }
        }
        if counted > 0 {
            loudness.append(decibels(fromMeanSquare: sumOfSquares / Double(counted)))
        }
        return Envelope(loudness: loudness, hop: hop)
    }

    /// Silence is zero, and the logarithm of zero is not a number, so digital
    /// black gets a floor rather than an infinity that would poison every
    /// comparison downstream.
    private static func decibels(fromMeanSquare meanSquare: Double) -> Double {
        let rms = meanSquare.squareRoot()
        guard rms > 1e-7 else { return -120 }
        return 20 * log10(rms)
    }
}
