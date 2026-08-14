import SwiftUI

struct AppShellView: View {
    // The shell has no visual dependency on editor state. Observing the whole
    // session here made every selection, caption edit and background waveform
    // update rebuild the sidebar and cross the WKWebView bridge as well.
    let session: EditorSession
    @AppStorage("studioSidebarExpanded") private var sidebarExpanded = true
    @AppStorage("studioDestination") private var destinationRaw = StudioDestination.home.rawValue
    @AppStorage("studioColorScheme") private var themeRaw = StudioTheme.dark.rawValue
    @AppStorage("editorLayoutMode") private var editorLayoutModeRaw = EditorLayoutMode.tallPreview.rawValue
    @AppStorage("editorTallWorkbenchFraction") private var editorTallWorkbenchFraction = 0.0
    @AppStorage("editorLayoutDefaultsVersion") private var editorLayoutDefaultsVersion = 0
    @Namespace private var sidebarSelection
    /// The web tab the hidden web view stays parked on while a native tab is in
    /// front. Home used to be the park, so coming back from the editor to the
    /// Idea Bank meant watching Home for a beat first. Parking where the
    /// creator was makes the common return instant, because the page is already
    /// the right one.
    @State private var parkedWebDestination = StudioDestination.home
    @ObservedObject private var auth = StudioAuth.shared
    @ObservedObject private var handoff = NativeAuthHandoff.shared

    /// The chrome is for people who are in. A signed-out window shows one door,
    /// not eleven locked ones.
    private var isSignedIn: Bool {
        auth.isSignedIn ?? true
    }

    /// What the one web view is showing: the tab, the tab it is parked on while
    /// a native tab is in front, or the sign-in card.
    private var webDestination: StudioDestination {
        guard isSignedIn else { return .signIn }
        return destination.isNative ? parkedWebDestination : destination
    }

    /// Hidden while a native tab is in front, and while the browser has the
    /// creator's attention mid sign-in.
    private var isWebViewVisible: Bool {
        guard isSignedIn else { return !handoff.isWaitingInBrowser }
        return !destination.isNative
    }

    private var destination: StudioDestination {
        StudioDestination(rawValue: destinationRaw) ?? .home
    }

    private var theme: StudioTheme {
        StudioTheme(rawValue: themeRaw) ?? .dark
    }

    var body: some View {
        HStack(spacing: 0) {
            if isSignedIn {
                StudioSidebar(
                    destination: destination,
                    expanded: sidebarExpanded,
                    selectionNamespace: sidebarSelection,
                    onNavigate: navigate
                )
                .frame(width: sidebarExpanded ? 238 : 66)
                .animation(.smooth(duration: 0.24), value: sidebarExpanded)
            }

            VStack(spacing: 0) {
                if isSignedIn {
                    StudioTopBar(
                    destination: destination,
                    sidebarExpanded: sidebarExpanded,
                    session: session,
                    theme: theme,
                    onNavigate: navigate,
                    toggleSidebar: {
                        withAnimation(.smooth(duration: 0.24)) {
                            sidebarExpanded.toggle()
                        }
                    },
                    toggleTheme: {
                        withAnimation(.smooth(duration: 0.2)) {
                            themeRaw = theme.next.rawValue
                        }
                    }
                )
                }

                ZStack {
                    PersistentEditorHost(
                        session: session,
                        isActive: destination == .editor
                    )
                        .opacity(destination == .editor ? 1 : 0)
                        .allowsHitTesting(destination == .editor)
                        .accessibilityHidden(destination != .editor)

                    // Built on arrival and torn down on the way out, unlike the
                    // editor: the library holds no work in progress, and one
                    // that stayed mounted would rebuild on every edit made in
                    // the tab next door.
                    if destination == .audio {
                        AudioLibraryPage(
                            session: session,
                            store: .shared,
                            onOpenEditor: { navigate(.editor) }
                        )
                    }

                    // Keep one authenticated web view alive behind the native
                    // editor. Clerk refreshes its short-lived session there,
                    // and native AI uploads read the resulting Yapper cookies.
                    // Signed out, this is the whole window: Clerk's own sign-in
                    // card, where an email and a password work without leaving
                    // the app. Only Google and Apple are sent to a browser, and
                    // only because they refuse to be shown here.
                    StudioPageView(destination: webDestination, onNavigate: navigate)
                        .opacity(isWebViewVisible ? 1 : 0)
                        .allowsHitTesting(isWebViewVisible)
                        .accessibilityHidden(!isWebViewVisible)
                    // A WKWebView goes on tracking the pointer at zero opacity,
                    // and sets the cursor from the web process, after everything
                    // the app does. Sitting full-size behind the editor it took
                    // the resize arrows back off every divider and handle a
                    // fraction of a second after they appeared. Parked outside
                    // the window it keeps the Clerk session alive exactly as
                    // before, without ever being under the pointer.
                    .offset(x: isWebViewVisible ? 0 : -50_000)
                    // The park is a jump, not a journey: left animated, the
                    // web view would slide fifty thousand points on every
                    // switch into the editor.
                    .transaction { $0.disablesAnimations = true }

                    if !isSignedIn, handoff.isWaitingInBrowser {
                        StudioSignInView()
                    }
                }
            }
            .minFrame()
        }
        .background(Color.editorBackground)
        .task {
            await auth.refresh()
            if auth.isSignedIn == false { auth.startWatching() }
        }
        .onChange(of: auth.isSignedIn) { _, signedIn in
            // Someone signing out mid-session lands on the door, and the watcher
            // picks them back up when they come through it.
            if signedIn == false { auth.startWatching() } else { auth.stopWatching() }
        }
        .onAppear {
            // A launch straight into a web tab parks on that tab, not on Home.
            if !destination.isNative { parkedWebDestination = destination }
            guard editorLayoutDefaultsVersion < 1 else { return }
            editorLayoutModeRaw = EditorLayoutMode.tallPreview.rawValue
            editorTallWorkbenchFraction = 0
            editorLayoutDefaultsVersion = 1
        }
    }

    private func navigate(_ next: StudioDestination) {
        guard next != destination else { return }
        if destination == .editor { session.pausePlayback() }
        if !next.isNative { parkedWebDestination = next }
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            destinationRaw = next.rawValue
        }
    }
}

private struct StudioSidebar: View {
    let destination: StudioDestination
    let expanded: Bool
    let selectionNamespace: Namespace.ID
    let onNavigate: (StudioDestination) -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 11) {
                YapperMark(size: 27)
                if expanded {
                    Text("Yapper Studio")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .lineLimit(1)
                        .transition(.opacity.combined(with: .offset(x: -4)))
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, expanded ? 15 : 17)
            .frame(height: 46)

            Rectangle().fill(Color.studioLine).frame(height: 1)

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(StudioDestination.groups, id: \.0) { group, items in
                        if !group.isEmpty, expanded {
                            Text(group.uppercased())
                                .font(.system(size: 10, weight: .bold))
                                .tracking(1.15)
                                .foregroundStyle(Color.secondary.opacity(0.72))
                                .padding(.top, 14)
                                .padding(.horizontal, 12)
                                .transition(.opacity)
                        } else if !group.isEmpty {
                            Spacer().frame(height: 10)
                        }

                        ForEach(items) { item in
                            Button {
                                onNavigate(item)
                            } label: {
                                HStack(spacing: 10) {
                                    StudioIcon(
                                        symbol: item.systemImage,
                                        selected: destination == item,
                                        size: 28
                                    )
                                    if expanded {
                                        Text(item.title)
                                            .font(.system(size: 13, weight: .semibold))
                                            .lineLimit(1)
                                    }
                                    Spacer(minLength: 0)
                                }
                                .foregroundStyle(
                                    destination == item ? Color.primary : Color.secondary
                                )
                                .padding(.horizontal, expanded ? 8 : 10)
                                .frame(height: 40)
                                .contentShape(Rectangle())
                                .background {
                                    if destination == item {
                                        RoundedRectangle(cornerRadius: 9, style: .continuous)
                                            .fill(Color.studioSelectedFill)
                                            .matchedGeometryEffect(
                                                id: "sidebar-selection",
                                                in: selectionNamespace
                                            )
                                        HStack {
                                            RoundedRectangle(cornerRadius: 2)
                                                .fill(Color.yapperOrange)
                                                .frame(width: 3, height: 17)
                                            Spacer()
                                        }
                                        .padding(.leading, 2)
                                    }
                                }
                            }
                            .buttonStyle(.studioPlain)
        .clickableCursor()
                            .help(item.title)
                        }
                    }
                }
                .padding(8)
            }

            Spacer(minLength: 0)
            Rectangle().fill(Color.studioLine).frame(height: 1)
            HStack(spacing: 10) {
                Circle()
                    .fill(Color(red: 0.78, green: 0.20, blue: 0.08))
                    .overlay(Text("C").font(.system(size: 12, weight: .bold)).foregroundStyle(.white))
                    .frame(width: 30, height: 30)
                if expanded {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Celpip Speaking Team")
                            .font(.system(size: 12, weight: .semibold))
                            .lineLimit(1)
                        Text("Workspace")
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
            }
            .padding(.horizontal, expanded ? 14 : 18)
            .frame(height: 58)
        }
        // Clip the content, then paint behind it. The other order clips the
        // background too, and a clipped background stops at the layout bounds
        // instead of reaching up through the hidden titlebar's safe-area inset,
        // which left the window colour showing behind the traffic lights.
        .clipped()
        .background(Color.sidebarBackground)
        .overlay(alignment: .trailing) {
            Rectangle().fill(Color.studioLine).frame(width: 1)
        }
    }
}

private struct StudioTopBar: View {
    let destination: StudioDestination
    let sidebarExpanded: Bool
    @ObservedObject var session: EditorSession
    let theme: StudioTheme
    let onNavigate: (StudioDestination) -> Void
    let toggleSidebar: () -> Void
    let toggleTheme: () -> Void
    @AppStorage("editorLayoutMode") private var layoutModeRaw = EditorLayoutMode.tallPreview.rawValue
    /// How much room the bar has, in steps, so the badge can decide whether its
    /// name fits rather than being clipped when it does not.
    @State private var barWidth: CGFloat = 1_200

    private var layoutMode: EditorLayoutMode {
        EditorLayoutMode(rawValue: layoutModeRaw) ?? .tallPreview
    }

    var body: some View {
        HStack(spacing: 8) {
            Button(action: toggleSidebar) {
                Image(systemName: sidebarExpanded ? "sidebar.left" : "sidebar.right")
                    .font(.system(size: 14, weight: .semibold))
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.studioPlain)
        .clickableCursor()
            .foregroundStyle(.secondary)
            .studioGlass(radius: 8)
            .help(sidebarExpanded ? "Collapse sidebar" : "Expand sidebar")

            Rectangle().fill(Color.studioLine).frame(width: 1, height: 22)
            Text(destination.title)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .contentTransition(.interpolate)

            Spacer()

            if destination == .editor {
                HStack(spacing: 2) {
                    ForEach(EditorLayoutMode.allCases) { mode in
                        Button {
                            withAnimation(.easeInOut(duration: 0.22)) {
                                layoutModeRaw = mode.rawValue
                            }
                        } label: {
                            Image(systemName: mode.icon)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(layoutMode == mode ? Color.yapperOrange : Color.secondary)
                                .frame(width: 27, height: 25)
                                .background(layoutMode == mode ? Color.yapperOrange.opacity(0.12) : Color.clear)
                                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                        }
                        .buttonStyle(.studioPlain)
        .clickableCursor()
                        .help(mode.title)
                    }
                }
                .padding(2)
                .background(Color.studioFaintFill)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .stroke(Color.studioLine, lineWidth: 1)
                }

                if session.isBusy || session.isExporting {
                    ProgressView().controlSize(.small)
                }
                Text(session.statusMessage)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .frame(maxWidth: 150, alignment: .trailing)
                Button {
                    ImportPanels.openMedia(for: session)
                } label: {
                    Label("Import", systemImage: "plus")
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .disabled(session.isBusy)
                Button {
                    ImportPanels.saveExport(for: session)
                } label: {
                    Label("Export", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(EditorPrimaryButtonStyle(size: .small))
                .disabled(session.project.clips.isEmpty || session.isBusy)
            }

            NativeThemeSwitcher(theme: theme, action: toggleTheme)

            WorkspaceProfileBadge(
                name: "Celpip Speaking Team",
                onNavigate: onNavigate,
                // The editor's own controls take the middle of this bar, so on a
                // narrow window the badge is what gets squeezed. It gives up its
                // name at a width it chooses rather than being cut off mid-word.
                showsName: barWidth >= 980
            )
        }
        .padding(.horizontal, 10)
        .frame(height: 46)
        .background {
            GeometryReader { proxy in
                Color.clear
                    .onAppear { barWidth = proxy.size.width }
                    .onChange(of: proxy.size.width) { _, width in
                        // In steps: the badge only cares which side of 980 it is
                        // on, and a state write per frame of a window resize is
                        // the whole editor rebuilt per frame. See PaneSizeStep.
                        let stepped = PaneSizeStep.rounded(width, step: 40)
                        guard stepped != barWidth else { return }
                        barWidth = stepped
                    }
            }
        }
        // The same tone as the sidebar, not a material: chrome is one
        // continuous surface across the top of the window, and `.regularMaterial`
        // resolved to a grey that belongs to no token in the ramp.
        .background(Color.sidebarBackground)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.studioLine).frame(height: 1)
        }
    }
}

private struct NativeThemeSwitcher: View {
    let theme: StudioTheme
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                RoundedRectangle(cornerRadius: 17, style: .continuous)
                    .fill(trackGradient)
                    .overlay {
                        RoundedRectangle(cornerRadius: 17, style: .continuous)
                            .stroke(trackStroke, lineWidth: 1)
                    }
                    .shadow(color: .black.opacity(theme == .dark ? 0.34 : 0.12), radius: 7, y: 3)

                HStack {
                    Image(systemName: "sun.max.fill")
                        .foregroundStyle(Color.orange.opacity(theme == .light ? 0.32 : 0.82))
                    Spacer()
                    Image(systemName: "moon.fill")
                        .foregroundStyle(Color.indigo.opacity(theme == .dark ? 0.32 : 0.72))
                }
                .font(.system(size: 11, weight: .bold))
                .padding(.horizontal, 10)

                Circle()
                    .fill(knobGradient)
                    .overlay {
                        Circle().stroke(Color.white.opacity(theme == .dark ? 0.18 : 0.9), lineWidth: 1)
                    }
                    .shadow(color: .black.opacity(0.34), radius: 4, y: 2)
                    .overlay {
                        Image(systemName: theme == .dark ? "moon.fill" : "sun.max.fill")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(theme == .dark ? Color.yellow.opacity(0.9) : Color.orange)
                    }
                    .frame(width: 22, height: 22)
                    .offset(x: theme == .dark ? 14 : -14)
            }
            .frame(width: 58, height: 28)
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .animation(.spring(response: 0.32, dampingFraction: 0.78), value: theme)
        .help(theme == .dark ? "Switch to light mode" : "Switch to dark mode")
        .accessibilityLabel(theme == .dark ? "Switch to light mode" : "Switch to dark mode")
    }

    private var trackGradient: LinearGradient {
        if theme == .dark {
            return LinearGradient(
                colors: [Color(red: 0.13, green: 0.17, blue: 0.24), Color(red: 0.035, green: 0.05, blue: 0.09)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        return LinearGradient(
            colors: [Color.white, Color(red: 0.82, green: 0.86, blue: 0.91)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var knobGradient: LinearGradient {
        if theme == .dark {
            return LinearGradient(
                colors: [Color(red: 0.38, green: 0.44, blue: 0.54), Color(red: 0.14, green: 0.18, blue: 0.25)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
        return LinearGradient(
            colors: [.white, Color(red: 0.94, green: 0.95, blue: 0.97)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private var trackStroke: Color {
        theme == .dark ? Color.white.opacity(0.12) : Color.black.opacity(0.12)
    }
}

private extension View {
    func minFrame() -> some View {
        frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
    }
}
