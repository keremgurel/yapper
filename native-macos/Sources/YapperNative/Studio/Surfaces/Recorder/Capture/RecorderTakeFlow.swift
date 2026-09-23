import Foundation

/// One take from the record button to review: countdown, record, pause and
/// resume on the same button, finish, then the file. The prompt scrolls only
/// while the take is really recording, after the lead-in.
@MainActor
final class RecorderTakeFlow: ObservableObject {
    @Published private(set) var take: RecorderTake?
    @Published private(set) var finishing = false

    let countdown = RecorderCountdown()
    let scroller = TeleprompterScroller()
    private let movie: RecorderMovieOutput
    private var leadIn: Task<Void, Never>?
    private var leadInDone = false

    init(movie: RecorderMovieOutput) {
        self.movie = movie
    }

    /// The center button: start with a countdown, cancel a countdown, or
    /// pause and resume a running take.
    func pressRecord(canRecord: Bool, leadInSeconds: Int, hasPrompt: Bool) {
        if countdown.active { return countdown.cancel() }
        switch movie.phase {
        case .idle:
            guard canRecord else { return }
            countdown.start { [weak self] in self?.begin(leadInSeconds: leadInSeconds, hasPrompt: hasPrompt) }
        case .recording:
            movie.pause()
            stopScrolling()
        case .paused:
            movie.resume()
            if hasPrompt { scroll(after: leadInDone ? 0 : leadInSeconds) }
        case .finishing:
            break
        }
    }

    func finish() {
        guard movie.isRecording else { return }
        stopScrolling()
        finishing = true
        Task {
            let url = await movie.stop()
            let finished = if let url { await RecorderTakeFinisher.finish(url) } else { RecorderTake?.none }
            take = finished
            finishing = false
        }
    }

    /// Throws the take away and gets ready for another.
    func retake() {
        take?.discard()
        take = nil
        scroller.reset()
    }

    /// Leaving the page mid-take: keep what was recorded for review.
    func interrupt() {
        countdown.cancel()
        if movie.isRecording { finish() }
    }

    private func begin(leadInSeconds: Int, hasPrompt: Bool) {
        leadInDone = false
        scroller.reset()
        movie.start()
        if hasPrompt { scroll(after: leadInSeconds) }
    }

    private func scroll(after seconds: Int) {
        leadIn?.cancel()
        leadIn = Task { [weak self] in
            if seconds > 0 { try? await Task.sleep(for: .seconds(seconds)) }
            guard !Task.isCancelled, let self, self.movie.phase == .recording else { return }
            self.leadInDone = true
            self.scroller.play()
        }
    }

    private func stopScrolling() {
        leadIn?.cancel()
        leadIn = nil
        scroller.pause()
    }
}
