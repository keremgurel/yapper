@preconcurrency import AppKit
import SwiftUI
@preconcurrency import WebKit

enum CloudLinkDisposition: Equatable {
    case allowInApp
    case navigateInShell(StudioDestination)
    case openInBrowser
}

enum CloudLinkRouter {
    static func disposition(
        for url: URL,
        nativeDestination: StudioDestination?
    ) -> CloudLinkDisposition {
        if isYapperHost(url.host) {
            if let destination = StudioDestination(cloudPath: url.path) {
                return destination == nativeDestination
                    ? .allowInApp
                    : .navigateInShell(destination)
            }
            return url.path.hasPrefix("/studio/") ? .allowInApp : .openInBrowser
        }

        switch url.scheme?.lowercased() {
        case "http", "https", "mailto", "tel":
            return .openInBrowser
        default:
            return .allowInApp
        }
    }

    static func isYapperHost(_ host: String?) -> Bool {
        host == "ypr.app" || host == "www.ypr.app"
    }
}

/// Hosts Yapper's authenticated, server-backed surfaces inside the native app.
/// Media editing remains fully native; account data, social OAuth, publishing,
/// schedules, and the content database keep one persistent web session.
struct CloudStudioView: View {
    let destination: StudioDestination
    let theme: StudioTheme
    let onNavigate: (StudioDestination) -> Void

    @ObservedObject private var commands = StudioWebCommands.shared

    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var reloadGeneration = 0
    /// The route the web view is really showing, kept outside the view: see
    /// `StudioWebPresentation` for why `@State` could not hold it.
    @ObservedObject private var presentation = StudioWebPresentation.shared

    /// Whether what is on screen is what the sidebar says is on screen.
    ///
    /// Switching tabs used to reveal the web view the instant the request went
    /// out, so the old page sat there under the new tab's name until Next
    /// finished: clicking Brain showed Home for a beat, then Brain. The view
    /// stays covered until the route it is on matches the one that was asked
    /// for.
    private var isShowingDestination: Bool {
        // Nothing to hide on the way to the sign-in card: there is no previous
        // page behind it worth covering, and a cover that outlives its reason
        // is an opaque sheet over the only button in the app.
        if destination == .signIn { return true }
        return destination.cloudPath == nil
            || presentation.shownPath == destination.cloudPath
    }

    var body: some View {
        ZStack {
            CloudStudioWebView(
                destination: destination,
                theme: theme,
                reloadGeneration: reloadGeneration,
                isLoading: $isLoading,
                errorMessage: $errorMessage,
                signOutGeneration: commands.signOutGeneration,
                manageAccountGeneration: commands.manageAccountGeneration,
                onNavigate: onNavigate
            )
            .opacity(isShowingDestination ? 1 : 0)

            if !isShowingDestination {
                StudioPageCover(destination: destination)
            }

            if isLoading, isShowingDestination {
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
    let signOutGeneration: Int
    let manageAccountGeneration: Int
    let onNavigate: (StudioDestination) -> Void

    private static var nativeUserAgentToken: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
            ?? "development"
        return "YapperStudioNative/\(version)"
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(
            theme: theme,
            isLoading: $isLoading,
            errorMessage: $errorMessage,
            onNavigate: onNavigate
        )
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.applicationNameForUserAgent = Self.nativeUserAgentToken
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
        webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) \(Self.nativeUserAgentToken)"
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsMagnification = false
        webView.setValue(false, forKey: "drawsBackground")
        context.coordinator.webView = webView
        context.coordinator.startObservingAuthenticationCallbacks()
        context.coordinator.lastReloadGeneration = reloadGeneration
        context.coordinator.lastSignOutGeneration = signOutGeneration
        context.coordinator.lastManageAccountGeneration = manageAccountGeneration
        load(destination, in: webView, coordinator: context.coordinator)
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        context.coordinator.isLoading = $isLoading
        context.coordinator.errorMessage = $errorMessage
        context.coordinator.onNavigate = onNavigate
        context.coordinator.nativeDestination = destination
        context.coordinator.currentTheme = theme

        if context.coordinator.lastSignOutGeneration != signOutGeneration {
            context.coordinator.lastSignOutGeneration = signOutGeneration
            context.coordinator.signOut(in: webView)
            return
        }

        if context.coordinator.lastManageAccountGeneration != manageAccountGeneration {
            context.coordinator.lastManageAccountGeneration = manageAccountGeneration
            webView.evaluateJavaScript("window.__yapperNativeManageAccount?.() === true")
            return
        }

        if context.coordinator.lastReloadGeneration != reloadGeneration, let url = destination.cloudURL {
            context.coordinator.lastReloadGeneration = reloadGeneration
            context.coordinator.requestedPath = destination.cloudPath
            isLoading = true
            webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
            return
        }

        // Updating an NSViewRepresentable is cheap until it sends work to the
        // web process. The shell can update for unrelated SwiftUI state, so
        // only cross that process boundary when the theme really changed.
        if context.coordinator.lastAppliedTheme != theme {
            context.coordinator.lastAppliedTheme = theme
            webView.evaluateJavaScript(Self.applyThemeScript(theme))
        }

        // A tab the app draws itself has no page to keep in step with. The web
        // view stays on whatever it was showing, signed in and ready.
        guard !destination.isNative else { return }
        let currentURL = webView.url
        let isYapperPage = currentURL?.host == "ypr.app" || currentURL?.host == "www.ypr.app"
        if isYapperPage, currentURL?.path != destination.cloudPath,
           context.coordinator.requestedPath != destination.cloudPath {
            navigate(destination, in: webView, coordinator: context.coordinator)
        }
    }

    static func dismantleNSView(_ webView: WKWebView, coordinator: Coordinator) {
        coordinator.stopObservingAuthenticationCallbacks()
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
        guard !destination.isNative, let url = destination.cloudURL else { return }
        coordinator.requestedPath = destination.cloudPath
        coordinator.armCover(for: destination.cloudPath)
        isLoading = true
        errorMessage = nil
        // Always ask whether the page has changed. WebKit's default policy will
        // serve a cached document without checking, so a Studio tab could keep
        // showing a version of itself from an earlier release for as long as
        // the cache held it, with no way for a creator to tell. The assets it
        // references are content-hashed and immutable, so only the document
        // costs a round trip.
        webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
    }

    /// Move between Studio tabs through Next's App Router. Falling back to a
    /// document load keeps startup and error recovery robust, but the normal
    /// path preserves React state, prefetched route payloads and client data.
    private func navigate(
        _ destination: StudioDestination,
        in webView: WKWebView,
        coordinator: Coordinator
    ) {
        guard let path = destination.cloudPath else { return }
        guard let literal = Coordinator.javascriptLiteral(path) else {
            load(destination, in: webView, coordinator: coordinator)
            return
        }
        coordinator.requestedPath = path
        // A router push that quietly does nothing (a page with no shell on it,
        // an error page) would otherwise leave the cover up for good.
        coordinator.armCover(for: path)
        let script = "window.__yapperNativeNavigate?.(\(literal)) === true"
        webView.evaluateJavaScript(script) { result, error in
            Task { @MainActor in
                guard error != nil || (result as? Bool) != true else { return }
                coordinator.requestedPath = nil
                load(destination, in: webView, coordinator: coordinator)
            }
        }
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
        const nativeThemeStorageKey = 'yapper-theme';
        const nativeThemeSessionKey = 'yapper-native-theme';
        let initialNativeTheme = '\(theme.rawValue)';
        try {
          initialNativeTheme = sessionStorage.getItem(nativeThemeSessionKey) || initialNativeTheme;
          sessionStorage.setItem(nativeThemeSessionKey, initialNativeTheme);
          localStorage.setItem(nativeThemeStorageKey, initialNativeTheme);
        } catch (_) {}
        window.__yapperNativeTheme = initialNativeTheme;
        window.__applyYapperNativeTheme = () => {
          const activeTheme = window.__yapperNativeTheme === 'dark' ? 'dark' : 'light';
          try {
            sessionStorage.setItem(nativeThemeSessionKey, activeTheme);
            localStorage.setItem(nativeThemeStorageKey, activeTheme);
          } catch (_) {}
          const shouldBeDark = activeTheme === 'dark';
          if (document.documentElement.classList.contains('dark') !== shouldBeDark) {
            document.documentElement.classList.toggle('dark', shouldBeDark);
          }
          if (document.documentElement.style.colorScheme !== activeTheme) {
            document.documentElement.style.colorScheme = activeTheme;
          }
        };
        window.__applyYapperNativeTheme();
        new MutationObserver(() => window.__applyYapperNativeTheme?.()).observe(
          document.documentElement,
          { attributes: true, attributeFilter: ['class', 'style'] }
        );

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
        window.__yapperNativeTheme = '\(theme.rawValue)';
        try {
          sessionStorage.setItem('yapper-native-theme', '\(theme.rawValue)');
          localStorage.setItem('yapper-theme', '\(theme.rawValue)');
        } catch (_) {}
        if (window.__applyYapperNativeTheme) {
          window.__applyYapperNativeTheme();
        } else {
          document.documentElement.classList.toggle('dark', \(theme == .dark ? "true" : "false"));
          document.documentElement.style.colorScheme = '\(theme.rawValue)';
        }
        window.dispatchEvent(new CustomEvent('yapper-native-theme-change', {
          detail: { theme: '\(theme.rawValue)' }
        }));
        """
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private static let authenticationStateKey = "yapperNativeAuthenticationState"
        weak var webView: WKWebView?
        private var oauthWindow: NSWindow?
        private weak var oauthWebView: WKWebView?
        private var authenticationState: String?
        private var authenticationObserverID: UUID?
        var isLoading: Binding<Bool>
        var errorMessage: Binding<String?>
        var onNavigate: (StudioDestination) -> Void
        var currentTheme: StudioTheme
        var lastAppliedTheme: StudioTheme
        var requestedPath: String?
        var lastReloadGeneration = 0
        /// The destination the cover is currently protecting. A page arriving
        /// for anything else is not the one being waited for.
        private var coveringPath: String?
        var lastSignOutGeneration = 0
        var lastManageAccountGeneration = 0
        var nativeDestination: StudioDestination?

        init(
            theme: StudioTheme,
            isLoading: Binding<Bool>,
            errorMessage: Binding<String?>,
            onNavigate: @escaping (StudioDestination) -> Void
        ) {
            currentTheme = theme
            lastAppliedTheme = theme
            self.isLoading = isLoading
            self.errorMessage = errorMessage
            self.onNavigate = onNavigate
        }

        /// Asks Clerk to end the session, and forgets it locally if the page
        /// cannot be asked.
        ///
        /// The fallback matters: a creator signed into the wrong account has to
        /// be able to get out of it without waiting for a deploy. It is weaker,
        /// because the session stays alive on the server until it expires, but
        /// it does put the sign-in screen back in front of them.
        func signOut(in webView: WKWebView) {
            webView.evaluateJavaScript("window.__yapperNativeSignOut?.() === true") { result, _ in
                Task { @MainActor in
                    guard (result as? Bool) != true else { return }
                    self.forgetSessionLocally(in: webView)
                }
            }
        }

        private func forgetSessionLocally(in webView: WKWebView) {
            let store = webView.configuration.websiteDataStore
            let types: Set<String> = [
                WKWebsiteDataTypeCookies,
                WKWebsiteDataTypeLocalStorage,
                WKWebsiteDataTypeSessionStorage,
            ]
            store.fetchDataRecords(ofTypes: types) { records in
                // Only Yapper's own and Clerk's: a creator's YouTube or TikTok
                // login in this session is not ours to throw away.
                let ours = records.filter { record in
                    record.displayName.contains("ypr.app")
                        || record.displayName.contains("clerk")
                        || record.displayName.contains("accounts.dev")
                }
                store.removeData(ofTypes: types, for: ours) {
                    Task { @MainActor in
                        webView.load(URLRequest(
                            url: URL(string: "https://ypr.app/studio/home?native=swift")!,
                            cachePolicy: .reloadIgnoringLocalCacheData
                        ))
                    }
                }
            }
        }

        /// Remember which destination the cover protects. Do not reveal the
        /// web view on a timer: under a slow connection it can still contain
        /// the previous tab, which is precisely what the cover exists to hide.
        func armCover(for path: String?) {
            coveringPath = path
        }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation?) {
            guard webView !== oauthWebView else { return }
            // A committed navigation has already replaced what was on screen,
            // so there is no stale page left to hide.
            report(shown: webView.url?.path)
        }

        /// A page arrived.
        ///
        /// The cover is cleared only when what arrived is what it is waiting
        /// for. A late commit from the page being navigated away from must not
        /// clear the new destination's safety net.
        func report(shown path: String?) {
            StudioWebPresentation.shared.shownPath = path
            guard path == coveringPath else { return }
            coveringPath = nil
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
            webView.evaluateJavaScript(CloudStudioWebView.applyThemeScript(currentTheme))
            isLoading.wrappedValue = false
            report(shown: webView.url?.path)
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
            // The error takes the whole surface, so the cover must come off or
            // it would hide the one thing the creator can act on.
            report(shown: webView?.url?.path)
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
            case "auth_state":
                guard
                    let arguments = payload["args"] as? [String: Any],
                    let signedIn = arguments["signedIn"] as? Bool
                else { return }
                StudioAuth.shared.report(signedIn: signedIn)
            case "route_changed":
                guard
                    let arguments = payload["args"] as? [String: Any],
                    let path = arguments["path"] as? String
                else { return }
                // Sent by the web shell once the App Router has committed the
                // new route. Until it arrives the previous page is still what
                // is painted, whatever the sidebar says.
                report(shown: path)
            case "open_microphone_settings":
                guard let url = URL(
                    string: "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Microphone"
                ) else { return }
                NSWorkspace.shared.open(url)
            case "native_auth_complete":
                clearAuthenticationState()
                errorMessage.wrappedValue = nil
                self.webView?.reload()
                Task { await StudioAuth.shared.refresh() }
            case "native_auth_error":
                let arguments = payload["args"] as? [String: Any]
                let message = arguments?["message"] as? String
                errorMessage.wrappedValue = message ?? "Couldn’t finish browser sign-in"
            default:
                break
            }
        }

        private func openBrowserAuthentication(_ baseURL: URL) {
            // One implementation, shared with the sign-in screen: two ways of
            // minting the state is two ways of failing to verify it.
            guard NativeAuthHandoff.shared.begin(at: baseURL) else {
                errorMessage.wrappedValue = "Couldn’t open your browser for sign-in"
                return
            }
        }

        private func finishBrowserAuthentication(callbackURL: URL) {
            guard
                let ticket = NativeAuthHandoff.ticket(
                    in: callbackURL,
                    expecting: NativeAuthHandoff.shared.expectedState
                )
            else {
                clearAuthenticationState()
                errorMessage.wrappedValue = "Browser sign-in could not be verified"
                return
            }

            guard let ticketLiteral = Self.javascriptLiteral(ticket) else {
                errorMessage.wrappedValue = "Browser sign-in returned an invalid ticket"
                return
            }
            let script = """
            (async () => {
              try {
                let clerk = window.Clerk;
                for (let attempt = 0; !clerk && attempt < 100; attempt += 1) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                  clerk = window.Clerk;
                }
                if (!clerk) throw new Error('Clerk is not ready');
                await clerk.load();
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

        func startObservingAuthenticationCallbacks() {
            guard authenticationObserverID == nil else { return }
            authenticationObserverID = NativeAuthHandoff.shared.observe { [weak self] url in
                self?.finishBrowserAuthentication(callbackURL: url)
            }
        }

        func stopObservingAuthenticationCallbacks() {
            NativeAuthHandoff.shared.removeObserver(authenticationObserverID)
            authenticationObserverID = nil
        }

        private func clearAuthenticationState() {
            authenticationState = nil
            NativeAuthHandoff.shared.clearState()
        }

        fileprivate static func javascriptLiteral(_ value: String) -> String? {
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
            configuration.applicationNameForUserAgent = CloudStudioWebView.nativeUserAgentToken
            configuration.defaultWebpagePreferences.allowsContentJavaScript = true
            let oauthWebView = WKWebView(frame: .zero, configuration: configuration)
            oauthWebView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 \(CloudStudioWebView.nativeUserAgentToken)"
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
            guard webView !== oauthWebView, let url = navigationAction.request.url
            else { return .allow }

            // Google will not serve OAuth to an embedded web view at all, so
            // this is the one thing that genuinely belongs in a real browser.
            // Caught at Clerk's kickoff, before the app leaves the page it is
            // showing.
            if NativeSignIn.needsSystemBrowser(url) {
                NativeAuthHandoff.shared.begin()
                return .cancel
            }

            guard navigationAction.navigationType == .linkActivated else { return .allow }

            switch CloudLinkRouter.disposition(for: url, nativeDestination: nativeDestination) {
            case .allowInApp:
                return .allow
            case let .navigateInShell(destination):
                onNavigate(destination)
                return .cancel
            case .openInBrowser:
                NSWorkspace.shared.open(url)
                return .cancel
            }
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
                if webView === oauthWebView {
                    webView.load(URLRequest(url: url))
                    return nil
                }

                switch CloudLinkRouter.disposition(for: url, nativeDestination: nativeDestination) {
                case .allowInApp:
                    webView.load(URLRequest(url: url))
                case let .navigateInShell(destination):
                    onNavigate(destination)
                case .openInBrowser:
                    NSWorkspace.shared.open(url)
                }
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
    /// The web route this tab shows, or nil for one the app draws itself.
    var cloudPath: String? {
        switch self {
        case .home: "/studio/home"
        case .brain: "/studio/brain"
        case .ideas: "/studio/ideas"
        case .library: "/studio/library"
        case .recorder: "/studio/recorder"
        case .editor: "/studio/editor"
        // Nothing to load: the audio library is a folder on this Mac, and there
        // is no page on the web that could show it.
        case .audio: nil
        case .poster: "/studio/poster"
        case .calendar: "/studio/calendar"
        case .automations: "/studio/automations"
        case .dictionary: "/studio/dictionary"
        case .connections: "/studio/connections"
        case .signIn: "/studio/app-sign-in"
        }
    }

    var cloudURL: URL? {
        guard let cloudPath else { return nil }
        return URL(string: "https://ypr.app\(cloudPath)?native=swift")
    }

    init?(cloudPath: String) {
        let normalized = cloudPath.hasSuffix("/") && cloudPath.count > 1
            ? String(cloudPath.dropLast())
            : cloudPath
        guard let match = StudioDestination.allCases.first(where: {
            guard let path = $0.cloudPath else { return false }
            return normalized == path || normalized.hasPrefix("\(path)/")
        }) else { return nil }
        self = match
    }
}
