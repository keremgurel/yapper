import SwiftUI

/// The recording light and running time, paused with the take.
struct RecorderTimeBadge: View {
    @ObservedObject var movie: RecorderMovieOutput

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.25)) { _ in
            HStack(spacing: 6) {
                if movie.phase == .paused {
                    Image(systemName: "pause.fill").font(.system(size: 11))
                } else {
                    Circle().fill(Color.studioDanger).frame(width: 9, height: 9)
                }
                Text(Self.format(movie.recordedSeconds))
                    .font(.system(size: 12, weight: .semibold).monospacedDigit())
                if movie.phase == .paused {
                    Text("Paused").font(.system(size: 11, weight: .medium)).foregroundStyle(.white.opacity(0.75))
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(Capsule().fill(Color.black.opacity(0.55)))
        }
    }

    static func format(_ seconds: Double) -> String {
        let whole = Int(seconds)
        return String(format: "%d:%02d", whole / 60, whole % 60)
    }
}

/// The big 3, 2, 1 before a take.
struct RecorderCountdownNumeral: View {
    @ObservedObject var countdown: RecorderCountdown

    var body: some View {
        if let count = countdown.count {
            Text("\(count)")
                .font(.system(size: 96, weight: .semibold).monospacedDigit())
                .foregroundStyle(.white)
                .contentTransition(.numericText(countsDown: true))
                .animation(.snappy, value: count)
                .allowsHitTesting(false)
        }
    }
}

/// A capture problem, shown over the frame where the creator is looking.
struct RecorderStageNotice: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(.white)
            .multilineTextAlignment(.leading)
            .padding(.horizontal, 12).padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.studioDanger.opacity(0.85)))
    }
}

/// How loud the microphone is right now.
struct RecorderAudioMeter: View {
    @ObservedObject var movie: RecorderMovieOutput

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1.0 / 20)) { _ in
            let level = movie.audioLevel
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.studioFaintFill)
                    Capsule().fill(Color.primary.opacity(0.55))
                        .frame(width: max(4, geo.size.width * level))
                }
            }
            .frame(height: 4)
            .accessibilityLabel("Microphone level")
        }
    }
}
