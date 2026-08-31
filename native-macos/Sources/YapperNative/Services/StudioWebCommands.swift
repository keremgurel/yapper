import Foundation
@preconcurrency import WebKit

struct StudioChirpyReply: Sendable {
    let text: String
    let notes: [String]
    let isTrouble: Bool
}

enum StudioChirpyBridgeError: LocalizedError {
    case webViewUnavailable
    case assistantUnavailable
    case invalidReply

    var errorDescription: String? {
        switch self {
        case .webViewUnavailable: "Studio is not ready yet."
        case .assistantUnavailable: "Chirpy is not ready on this page."
        case .invalidReply: "Chirpy returned an unreadable reply."
        }
    }
}

/// Things the native chrome needs the web session to do.
///
/// The account lives with Clerk, in the web view's cookies, so signing out is
/// not something the app can do to itself: clearing the jar locally would leave
/// the session alive on the server and log the creator out of nothing. The
/// native menu raises a request here, the web view carries it out, and Clerk
/// stays the only thing that decides who is signed in.
///
/// A counter rather than a flag, so two sign-outs in a row are two requests.
@MainActor
final class StudioWebCommands: ObservableObject {
    static let shared = StudioWebCommands()

    @Published private(set) var signOutGeneration = 0
    @Published private(set) var manageAccountGeneration = 0
    @Published private(set) var posterGeneration = 0
    @Published private(set) var posterItemID: String?
    private weak var webView: WKWebView?

    func signOut() {
        signOutGeneration += 1
        // Clerk clears its cookies as it goes; the shell looks again shortly
        // after so the window falls back to the sign-in screen by itself.
        StudioAuth.shared.forgetWebReport()
        Task {
            try? await Task.sleep(for: .milliseconds(600))
            await StudioAuth.shared.refresh()
        }
    }
    func manageAccount() { manageAccountGeneration += 1 }

    func openPoster(itemID: String) {
        posterItemID = itemID
        posterGeneration += 1
    }

    func register(webView: WKWebView) {
        self.webView = webView
    }

    func unregister(webView: WKWebView) {
        if self.webView === webView { self.webView = nil }
    }

    /// A fresh Clerk token for native API calls.
    ///
    /// Clerk's API cookie is deliberately short-lived. The hidden Studio page
    /// can still have a perfectly valid client session while that cookie is
    /// between refreshes, especially just after launch. Asking Clerk itself
    /// avoids turning that timing window into a spurious sign-out.
    func sessionToken() async -> String? {
        guard let webView else { return nil }
        let result = try? await webView.callAsyncJavaScript(
            """
            let clerk = window.Clerk;
            if (!clerk) return null;
            await clerk.load();
            return await clerk.session?.getToken() ?? null;
            """,
            arguments: [:],
            in: nil,
            contentWorld: .page
        )
        guard let token = result as? String, !token.isEmpty else { return nil }
        return token
    }

    /// Runs the same Brain-aware Chirpy action as the browser UI, but returns
    /// the settled reply to the native transcript.
    func askChirpy(_ instruction: String) async throws -> StudioChirpyReply {
        guard let webView else { throw StudioChirpyBridgeError.webViewUnavailable }
        let result = try await webView.callAsyncJavaScript(
            """
            if (typeof window.__yapperNativeChirpy !== 'function') {
              throw new Error('Chirpy is not ready');
            }
            return await window.__yapperNativeChirpy(instruction);
            """,
            arguments: ["instruction": instruction],
            in: nil,
            contentWorld: .page
        )
        guard let payload = result as? [String: Any] else {
            throw StudioChirpyBridgeError.invalidReply
        }
        guard let text = payload["text"] as? String, !text.isEmpty else {
            throw StudioChirpyBridgeError.invalidReply
        }
        return StudioChirpyReply(
            text: text,
            notes: payload["notes"] as? [String] ?? [],
            isTrouble: payload["tone"] as? String == "trouble"
        )
    }
}
