import Foundation

/// `{ url, expiresInSeconds }` from `POST api/handoff/phone`.
struct IdeaCanvasPhoneTicket: Decodable, Equatable {
    let url: String
    let expiresInSeconds: Int
}

/// The one-use sign-in link that opens this script in the phone's
/// teleprompter. The link is a bearer credential, so it is minted only on
/// request, never stored, and dropped the moment it expires.
@MainActor
final class IdeaCanvasPhoneHandoff: ObservableObject {
    enum Phase: Equatable { case idle, minting, ready(String), expired, failed }

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var secondsLeft = 0
    private var countdown: Task<Void, Never>?

    private struct Body: Encodable { let to: String }

    func mint(itemID: String, beforeOpen: () async throws -> Void) async {
        guard phase != .minting else { return }
        phase = .minting
        do {
            try await beforeOpen()
            let ticket: IdeaCanvasPhoneTicket = try await StudioJSONClient.post(
                "api/handoff/phone", body: Body(to: "/studio/recorder?item=\(itemID)")
            )
            secondsLeft = ticket.expiresInSeconds
            phase = .ready(ticket.url)
            startCountdown()
        } catch {
            phase = .failed
        }
    }

    func reset() {
        countdown?.cancel()
        phase = .idle
    }

    private func startCountdown() {
        countdown?.cancel()
        countdown = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard let self, !Task.isCancelled else { return }
                if self.secondsLeft > 1 {
                    self.secondsLeft -= 1
                } else {
                    self.secondsLeft = 0
                    self.phase = .expired
                    return
                }
            }
        }
    }
}
