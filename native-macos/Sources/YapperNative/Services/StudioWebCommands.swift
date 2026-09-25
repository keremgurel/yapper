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
    @Published private(set) var assistantGeneration = 0
    @Published private(set) var editorRequest: StudioEditorRequest?
    private var assistantPrompt: String?
    private weak var webView: WKWebView?

    func signOut() {
        signOutGeneration += 1
        cachedToken = nil
        Task { await APIReadCache.shared.clear() }
        // Clerk clears its cookies as it goes; the shell looks again shortly
        // after so the window falls back to the sign-in screen by itself.
        StudioAuth.shared.forgetWebReport()
        Task {
            try? await Task.sleep(for: .milliseconds(600))
            await StudioAuth.shared.refresh()
        }
    }
    func manageAccount() { manageAccountGeneration += 1 }

    func openAssistant(prompt: String?) {
        assistantPrompt = prompt
        assistantGeneration += 1
    }

    func openEditor(_ request: StudioEditorRequest) {
        // Web navigation and its committed page can both report the same click.
        guard editorRequest?.itemID != request.itemID || editorRequest == nil else { return }
        editorRequest = request
    }

    func finishEditorRequest(_ id: UUID) {
        if editorRequest?.id == id { editorRequest = nil }
    }

    func takeAssistantPrompt() -> String? {
        defer { assistantPrompt = nil }
        return assistantPrompt
    }

    func openPoster(itemID: String) {
        posterItemID = itemID
        posterGeneration += 1
    }

    /// Opens a platform's sign-in window from a native page. The flow runs in
    /// the web session so the connection lands on the signed-in account.
    func openOAuth(path: String) {
        guard let webView, let literal = try? String(
            data: JSONSerialization.data(withJSONObject: ["url": "https://ypr.app\(path)"]),
            encoding: .utf8
        ) else { return }
        webView.evaluateJavaScript(
            "window.webkit?.messageHandlers?.yapperNative?.postMessage({command:'open_oauth_flow', args:\(literal)})"
        )
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
    ///
    /// Tried in order: a token minted in the last 30 seconds (they live for a
    /// minute), Clerk's Frontend API directly, then the hidden page. Requests
    /// fired together share each attempt instead of starting their own.
    ///
    /// - Parameter askPage: false to never wait on the hidden page, which can
    ///   take seconds right after launch while it starts clerk-js.
    func sessionToken(askPage: Bool = true) async -> String? {
        if let cached = cachedToken, Date().timeIntervalSince(cached.at) < 30 {
            return cached.token
        }
        if let token = await shared(\.pendingDirect, { await ClerkTokenRefresher.mint() }) {
            return token
        }
        guard askPage else { return nil }
        return await shared(\.pendingPage) { [weak self] in await self?.tokenFromPage() }
    }

    private var pendingDirect: Task<String?, Never>?
    private var pendingPage: Task<String?, Never>?

    /// Runs `mint` once for everyone waiting on the same slot, and keeps
    /// what it returns as the cached token.
    private func shared(
        _ slot: ReferenceWritableKeyPath<StudioWebCommands, Task<String?, Never>?>,
        _ mint: @escaping @MainActor () async -> String?
    ) async -> String? {
        if let pending = self[keyPath: slot] { return await pending.value }
        let task = Task { await mint() }
        self[keyPath: slot] = task
        defer { if self[keyPath: slot] == task { self[keyPath: slot] = nil } }
        guard let token = await task.value else { return nil }
        cachedToken = (token, Date())
        return token
    }

    private func tokenFromPage() async -> String? {
        let result = await runJavaScript(
            """
            let clerk = window.Clerk;
            if (!clerk) return null;
            await clerk.load();
            return await clerk.session?.getToken() ?? null;
            """,
            timeout: 3
        )
        guard let token = result as? String, !token.isEmpty else { return nil }
        return token
    }

    private var cachedToken: (token: String, at: Date)?

    /// Drops the reused token so the next request asks Clerk for a new one.
    func forgetToken() { cachedToken = nil }

    /// Runs page JavaScript with a deadline. The hidden page can be asleep,
    /// mid-reload or gone after the Mac sleeps, and a call into it then never
    /// answers; without a deadline every native request waited on it forever.
    private func runJavaScript(_ script: String, timeout: TimeInterval) async -> Any? {
        guard let webView else { return nil }
        final class Once: @unchecked Sendable {
            var done = false
        }
        /// JavaScript results are plists (strings, numbers, dictionaries),
        /// read once on the main actor.
        struct Result: @unchecked Sendable { let value: Any? }
        let once = Once()
        let result = await withCheckedContinuation { (continuation: CheckedContinuation<Result, Never>) in
            webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { outcome in
                let value = Result(value: try? outcome.get())
                Task { @MainActor in
                    guard !once.done else { return }
                    once.done = true
                    continuation.resume(returning: value)
                }
            }
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(timeout))
                guard !once.done else { return }
                once.done = true
                continuation.resume(returning: Result(value: nil))
            }
        }
        return result.value
    }

    /// Who is signed in, asked of Clerk directly. The web shell used to report
    /// this when a Studio page mounted, but every tab is native now and the
    /// parked page may never report.
    func accountIdentity() async -> (id: String, name: String?, email: String?)? {
        let result = await runJavaScript(
            """
            let clerk = window.Clerk;
            if (!clerk) return null;
            await clerk.load();
            const user = clerk.user;
            if (!user) return null;
            const name = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || null;
            return { id: user.id, name, email: user.primaryEmailAddress?.emailAddress ?? null };
            """,
            timeout: 3
        )
        guard let payload = result as? [String: Any], let id = payload["id"] as? String else { return nil }
        return (id, payload["name"] as? String, payload["email"] as? String)
    }

    /// Runs the same Brain-aware Chirpy action as the browser UI, but returns
    /// the settled reply to the native transcript.
    func askChirpy(
        _ instruction: String,
        surface: String? = nil,
        history: [(author: AssistantMessage.Author, text: String)] = []
    ) async throws -> StudioChirpyReply {
        guard let webView else { throw StudioChirpyBridgeError.webViewUnavailable }
        let context: [String: Any] = [
            "surface": surface ?? NSNull(),
            "history": history.map { ["author": $0.author.rawValue, "text": $0.text] },
        ]
        let result = try await webView.callAsyncJavaScript(
            """
            if (typeof window.__yapperNativeChirpy !== 'function') {
              throw new Error('Chirpy is not ready');
            }
            return await window.__yapperNativeChirpy(instruction, context);
            """,
            arguments: ["instruction": instruction, "context": context],
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
