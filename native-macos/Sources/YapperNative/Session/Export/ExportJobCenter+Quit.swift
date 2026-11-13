import Foundation

extension ExportJobCenter {
    /// Cancels every running job and waits, at most `timeout`, for each one to
    /// stop. A canceled export removes its staged file and its intermediate on
    /// the way out, so quitting without this wait left both on disk.
    ///
    /// True when every job stopped in time.
    @discardableResult
    func cancelAll(waitingAtMost timeout: Duration) async -> Bool {
        let ids = runningJobs.map(\.id)
        guard !ids.isEmpty else { return true }
        ids.forEach(cancel)
        return await withCheckedContinuation { continuation in
            let answer = FirstAnswer(continuation)
            Task { @MainActor in
                for id in ids { _ = await self.completion(of: id) }
                answer.give(true)
            }
            Task { @MainActor in
                try? await Task.sleep(for: timeout)
                answer.give(false)
            }
        }
    }
}

/// Resumes a continuation once, with whichever answer arrives first.
@MainActor
private final class FirstAnswer {
    private var continuation: CheckedContinuation<Bool, Never>?

    init(_ continuation: CheckedContinuation<Bool, Never>) {
        self.continuation = continuation
    }

    func give(_ answer: Bool) {
        continuation?.resume(returning: answer)
        continuation = nil
    }
}
