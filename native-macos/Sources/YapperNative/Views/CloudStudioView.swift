@preconcurrency import AppKit
@preconcurrency import AuthenticationServices
import SwiftUI
@preconcurrency import WebKit

/// Hosts Yapper's authenticated, server-backed surfaces inside the native app.
/// Media editing remains fully native; account data, social OAuth, publishing,
/// schedules, and the content database keep one persistent web session.
struct CloudStudioView: View {
    let destination: StudioDestination
    let theme: StudioTheme
    let onNavigate: (StudioDestination) -> Void

    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var reloadGeneration = 0

    var body: some View {
        ZStack {
            CloudStudioWebView(
                destination: destination,
                theme: theme,
                reloadGeneration: reloadGeneration,
                isLoading: $isLoading,
                errorMessage: $errorMessage,
                onNavigate: onNavigate
            )

            if isLoading {
                ProgressView("Loading " + destination.title + "…")
                    .controlSize(.small)
                    .padding(.horizontal, 16)
                    .frame(height: 42)
                    .studioGlass(radius: 9)
            }

            if let errorMessage {
                ContentUnavailableView {
                    Label("Couldn’t load " + destination.title, systemImage: "wifi.exclamationmark")
                } description: {
                    Text(errorMessage)
                } actions: {
                    Button("Try again") {
                        self.errorMessage = nil
                        reloadGeneration += 1
                    }
                    .buttonStyle(EditorPrimaryButtonStyle())
                }
                .padding(32)
                .background(Color.editorBackground)
            }
        }
        .background(Color.editorBackground)
    }
}

private struct CloudStudioWebView: NSViewRepresentable {
    let destination: StudioDestination
    let theme: StudioTheme
    let reloadGeneration: Int
    @Binding var isLoading: Bool
    @Binding var errorMessage: String?
    let onNavigate: (StudioDestination) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(
            isLoading: $isLoading,
            errorMessage: $errorMessage,
            onNavigate: onNavigate
        )
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.applicationNameForUserAgent = "YapperStudioNative/0.9.14"
        configuration.preferences.isElementFullscreenEnabled = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let controller = configuration.userContentController
        controller.add(context.coordinator, name: "yapperNative")
        controller.addUserScript(
            WKUserScript(
                source: Self.shellScript(theme: theme),
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true,
                in: .page
            )
        )
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) YapperStudioNative/0.9.14"
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsMagnification = false
        webView.setValue(false, forKey: "drawsBackground")
        context.coordinator.webView = webView
        context.coordinator.lastReloadGeneration = reloadGeneration
        load(destination, in: webView, coordinator: context.coordinator)
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        context.coordinator.isLoading = $isLoading
        context.coordinator.errorMessage = $errorMessage
        context.coordinator.onNavigate = onNavigate
        context.coordinator.nativeDestination = destination

        if context.coordinator.lastReloadGeneration != reloadGeneration {
            context.coordinator.lastReloadGeneration = reloadGeneration
            context.coordinator.requestedPath = destination.cloudPath
            isLoading = true
            webView.load(URLRequest(url: destination.cloudURL, cachePolicy: .reloadIgnoringLocalCacheData))
            return
        }

        let themeScript = Self.applyThemeScript(theme)
        webView.evaluateJavaScript(themeScript)

        guard destination != .editor else { return }
        let currentURL = webView.url
        let isYapperPage = currentURL?.host == "ypr.app" || currentURL?.host == "www.ypr.app"
        if isYapperPage, currentURL?.path != destination.cloudPath,
           context.coordinator.requestedPath != destination.cloudPath {
            load(destination, in: webView, coordinator: context.coordinator)
        }
    }

    static func dismantleNSView(_ webView: WKWebView, coordinator: Coordinator) {
        coordinator.cancelAuthentication()
        webView.stopLoading()
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "yapperNative")
        webView.navigationDelegate = nil
        webView.uiDelegate = nil
    }

    private func load(
        _ destination: StudioDestination,
        in webView: WKWebView,
        coordinator: Coordinator
    ) {
        guard destination != .editor else { return }
        coordinator.requestedPath = destination.cloudPath
        isLoading = true
        errorMessage = nil
        webView.load(URLRequest(url: destination.cloudURL))
    }

    private static func shellScript(theme: StudioTheme) -> String {
        """
        // The deployed Studio is intentionally app-only. Mark this trusted
        // first-party WebKit host before React evaluates its route boundary.
        // This runs for every full navigation. Keep the marker re-definable so
        // same-origin route loads cannot abort the rest of this bootstrap.
        try {
          Object.defineProperty(window, '__TAURI_INTERNALS__', {
            value: { shell: 'swift' }, configurable: true, enumerable: false
          });
        } catch (_) {
          window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ || { shell: 'swift' };
        }
        // Match the public bridge marker used by the existing Studio client.
        // OAuth stays in this persistent WebKit session so Clerk and provider
        // cookies remain available through the entire connection round trip.
        window.__TAURI__ = {
          core: {
            convertFileSrc: (path) => path,
            invoke: async (command, args = {}) => {
              if (command === 'open_auth_flow' || command === 'open_oauth_flow' || command === 'open_microphone_settings') {
                window.webkit.messageHandlers.yapperNative.postMessage({ command, args });
                return null;
              }
              throw new Error(`Native command ${command} is unavailable on this cloud surface`);
            }
          }
        };
        document.documentElement.setAttribute('data-app', '');
        document.documentElement.setAttribute('data-yapper-native-swift', '');
        try { localStorage.setItem('theme', '\(theme.rawValue)'); } catch (_) {}

        const nativeStyle = document.createElement('style');
        nativeStyle.id = 'yapper-native-swift-shell';
        nativeStyle.textContent = `
          html, body { min-height: 100%; background: transparent !important; }
          .marketing-chrome { display: none !important; }
          [data-slot="sidebar-wrapper"] { display: block !important; min-height: 100vh !important; }
          [data-slot="sidebar-wrapper"] > [data-slot="sidebar"] { display: none !important; }
          [data-slot="sidebar-inset"] { width: 100% !important; min-height: 100vh !important; margin: 0 !important; }
          [data-slot="sidebar-inset"] > :first-child { display: none !important; }
          [data-slot="sidebar-inset"] > main { min-height: 100vh !important; padding: 28px 32px !important; }
        `;
        document.documentElement.appendChild(nativeStyle);
        """
    }

    private static func applyThemeScript(_ theme: StudioTheme) -> String {
        """
        try { localStorage.setItem('theme', '\(theme.rawValue)'); } catch (_) {}
        document.documentElement.classList.toggle('dark', \(theme == .dark ? "true" : "false"));
        document.documentElement.style.colorScheme = '\(theme.rawValue)';
        """
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler,
        ASWebAuthenticationPresentationContextProviding
    {
        weak var webView: WKWebView?
        private var oauthWindow: NSWindow?
        private weak var oauthWebView: WKWebView?
        private var authenticationSession: ASWebAuthenticationSession?
        private var authenticationState: String?
        var isLoading: Binding<Bool>
        var errorMessage: Binding<String?>
        var onNavigate: (StudioDestination) -> Void
        var requestedPath: String?
        var lastReloadGeneration = 0
        var nativeDestination: StudioDestination?

        init(
            isLoading: Binding<Bool>,
            errorMessage: Binding<String?>,
            onNavigate: @escaping (StudioDestination) -> Void
        ) {
            self.isLoading = isLoading
            self.errorMessage = errorMessage
            self.onNavigate = onNavigate
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation?) {
            guard webView !== oauthWebView else { return }
            isLoading.wrappedValue = true
            errorMessage.wrappedValue = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
            if webView === oauthWebView {
                guard
                    let url = webView.url,
                    Self.isYapperHost(url.host),
                    url.path == "/studio/connections"
                else { return }
                oauthWindow?.close()
                oauthWindow = nil
                self.webView?.reload()
                return
            }
            isLoading.wrappedValue = false
            requestedPath = nil
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation?,
            withError error: Error
        ) {
            guard webView !== oauthWebView else { return }
            handleLoadFailure(error)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation?, withError error: Error) {
            guard webView !== oauthWebView else { return }
            handleLoadFailure(error)
        }

        private func handleLoadFailure(_ error: Error) {
            let nsError = error as NSError
            guard nsError.code != NSURLErrorCancelled else { return }
            isLoading.wrappedValue = false
            errorMessage.wrappedValue = error.localizedDescription
            requestedPath = nil
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard
                message.name == "yapperNative",
                let payload = message.body as? [String: Any],
                let command = payload["command"] as? String
            else { return }

            switch command {
            case "open_auth_flow":
                guard
                    let arguments = payload["args"] as? [String: Any],
                    let rawURL = arguments["url"] as? String,
                    let url = URL(string: rawURL),
                    Self.isYapperHost(url.host),
                    url.path == "/studio/native-auth"
                else { return }
                openBrowserAuthentication(url)
            case "open_oauth_flow":
                guard
                    let arguments = payload["args"] as? [String: Any],
                    let rawURL = arguments["url"] as? String,
                    let url = URL(string: rawURL),
                    Self.isYapperHost(url.host)
                else { return }
                openOAuthWindow(url)
            case "open_microphone_settings":
                guard let url = URL(
                    string: "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Microphone"
                ) else { return }
                NSWorkspace.shared.open(url)
            case "native_auth_complete":
                authenticationSession = nil
                authenticationState = nil
                errorMessage.wrappedValue = nil
                self.webView?.reload()
            case "native_auth_error":
                let arguments = payload["args"] as? [String: Any]
                let message = arguments?["message"] as? String
                errorMessage.wrappedValue = message ?? "Couldn’t finish browser sign-in"
            default:
                break
            }
        }

        private func openBrowserAuthentication(_ baseURL: URL) {
            cancelAuthentication()
            let state = UUID().uuidString.lowercased()
            guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else { return }
            var queryItems = components.queryItems ?? []
            queryItems.removeAll { $0.name == "state" }
            queryItems.append(URLQueryItem(name: "state", value: state))
            components.queryItems = queryItems
            guard let url = components.url else { return }

            authenticationState = state
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: "yapper-studio"
            ) { [weak self] callbackURL, error in
                Task { @MainActor in
                    self?.finishBrowserAuthentication(callbackURL: callbackURL, error: error)
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            authenticationSession = session
            guard session.start() else {
                authenticationSession = nil
                authenticationState = nil
                errorMessage.wrappedValue = "Couldn’t open your browser for sign-in"
                return
            }
        }

        private func finishBrowserAuthentication(callbackURL: URL?, error: Error?) {
            if let error = error as? ASWebAuthenticationSessionError,
               error.code == .canceledLogin {
                authenticationSession = nil
                authenticationState = nil
                return
            }
            guard
                error == nil,
                let callbackURL,
                callbackURL.scheme == "yapper-studio",
                callbackURL.host == "auth",
                callbackURL.path == "/callback",
                let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                let ticket = components.queryItems?.first(where: { $0.name == "ticket" })?.value,
                let returnedState = components.queryItems?.first(where: { $0.name == "state" })?.value,
                returnedState == authenticationState,
                !ticket.isEmpty
            else {
                authenticationSession = nil
                authenticationState = nil
                errorMessage.wrappedValue = error?.localizedDescription ?? "Browser sign-in could not be verified"
                return
            }

            guard let ticketLiteral = Self.javascriptLiteral(ticket) else {
                errorMessage.wrappedValue = "Browser sign-in returned an invalid ticket"
                return
            }
            let script = """
            (async () => {
              try {
                const clerk = window.Clerk;
                if (!clerk) throw new Error('Clerk is not ready');
                const signIn = await clerk.client.signIn.create({
                  strategy: 'ticket',
                  ticket: \(ticketLiteral)
                });
                if (signIn.status !== 'complete' || !signIn.createdSessionId) {
                  throw new Error('Sign-in did not complete');
                }
                await clerk.setActive({ session: signIn.createdSessionId });
                window.webkit.messageHandlers.yapperNative.postMessage({
                  command: 'native_auth_complete', args: {}
                });
              } catch (error) {
                window.webkit.messageHandlers.yapperNative.postMessage({
                  command: 'native_auth_error',
                  args: { message: error?.message || 'Could not finish browser sign-in' }
                });
              }
            })();
            """
            webView?.evaluateJavaScript(script) { [weak self] _, evaluationError in
                guard let evaluationError else { return }
                Task { @MainActor in
                    self?.errorMessage.wrappedValue = evaluationError.localizedDescription
                }
            }
        }

        func cancelAuthentication() {
            authenticationSession?.cancel()
            authenticationSession = nil
            authenticationState = nil
        }

        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            webView?.window ?? NSApp.keyWindow ?? NSWindow()
        }

        private static func javascriptLiteral(_ value: String) -> String? {
            guard
                let data = try? JSONSerialization.data(withJSONObject: value, options: .fragmentsAllowed)
            else { return nil }
            return String(data: data, encoding: .utf8)
        }

        private func openOAuthWindow(_ url: URL) {
            if let oauthWindow, let oauthWebView {
                oauthWebView.load(URLRequest(url: url))
                oauthWindow.makeKeyAndOrderFront(nil)
                return
            }

            let configuration = WKWebViewConfiguration()
            configuration.websiteDataStore = .default()
            configuration.applicationNameForUserAgent = "YapperStudioNative/0.9.14"
            configuration.defaultWebpagePreferences.allowsContentJavaScript = true
            let oauthWebView = WKWebView(frame: .zero, configuration: configuration)
            oauthWebView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 YapperStudioNative/0.9.14"
            oauthWebView.navigationDelegate = self
            oauthWebView.uiDelegate = self

            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 540, height: 740),
                styleMask: [.titled, .closable, .resizable],
                backing: .buffered,
                defer: false
            )
            window.title = "Connect account"
            window.contentView = oauthWebView
            window.center()
            window.makeKeyAndOrderFront(nil)

            self.oauthWebView = oauthWebView
            oauthWindow = window
            oauthWebView.load(URLRequest(url: url))
        }

        private static func isYapperHost(_ host: String?) -> Bool {
            host == "ypr.app" || host == "www.ypr.app"
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction
        ) async -> WKNavigationActionPolicy {
            guard
                navigationAction.navigationType == .linkActivated,
                let url = navigationAction.request.url,
                url.host == "ypr.app" || url.host == "www.ypr.app",
                let destination = StudioDestination(cloudPath: url.path),
                destination != nativeDestination
            else { return .allow }
            onNavigate(destination)
            return .cancel
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
                webView.load(URLRequest(url: url))
            }
            return nil
        }

        func webView(
            _ webView: WKWebView,
            runOpenPanelWith parameters: WKOpenPanelParameters,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping @MainActor @Sendable ([URL]?) -> Void
        ) {
            let panel = NSOpenPanel()
            panel.canChooseFiles = true
            panel.canChooseDirectories = parameters.allowsDirectories
            panel.allowsMultipleSelection = parameters.allowsMultipleSelection
            panel.begin { response in
                completionHandler(response == .OK ? panel.urls : nil)
            }
        }

        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping @MainActor @Sendable (WKPermissionDecision) -> Void
        ) {
            let trusted = origin.host == "ypr.app" || origin.host == "www.ypr.app"
            decisionHandler(trusted ? .grant : .deny)
        }
    }
}

private extension StudioDestination {
    var cloudPath: String {
        switch self {
        case .home: "/studio/home"
        case .ideas: "/studio/ideas"
        case .library: "/studio/library"
        case .recorder: "/studio/recorder"
        case .editor: "/studio/editor"
        case .poster: "/studio/poster"
        case .calendar: "/studio/calendar"
        case .automations: "/studio/automations"
        case .dictionary: "/studio/dictionary"
        case .connections: "/studio/connections"
        }
    }

    var cloudURL: URL {
        URL(string: "https://ypr.app\(cloudPath)?native=swift")!
    }

    init?(cloudPath: String) {
        let normalized = cloudPath.hasSuffix("/") && cloudPath.count > 1
            ? String(cloudPath.dropLast())
            : cloudPath
        guard let match = StudioDestination.allCases.first(where: {
            normalized == $0.cloudPath || normalized.hasPrefix("\($0.cloudPath)/")
        }) else { return nil }
        self = match
    }
}
