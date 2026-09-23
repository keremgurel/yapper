import Foundation
import QuartzCore

/// Moves the prompt up at a reading pace: play, pause, reset. The overlay
/// reports how far the text can travel so the scroll stops at the end.
@MainActor
final class TeleprompterScroller: ObservableObject {
    @Published private(set) var offset: Double = 0
    @Published private(set) var running = false

    /// How far the text can move before its last line reaches the bottom.
    var maxOffset: Double = 0
    var pointsPerSecond: Double = 0

    private var timer: Timer?
    private var lastTick: CFTimeInterval?

    func play() {
        guard timer == nil else { return }
        running = true
        lastTick = nil
        let timer = Timer(timeInterval: 1.0 / 60, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
    }

    func pause() {
        timer?.invalidate()
        timer = nil
        lastTick = nil
        running = false
    }

    func reset() {
        pause()
        offset = 0
    }

    private func tick() {
        let now = CACurrentMediaTime()
        defer { lastTick = now }
        guard let lastTick else { return }
        offset += pointsPerSecond * (now - lastTick)
        if maxOffset > 0, offset >= maxOffset {
            offset = maxOffset
            pause()
        }
    }
}
