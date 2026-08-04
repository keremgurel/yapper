import SwiftUI

struct AppShellView: View {
    @ObservedObject var session: EditorSession
    @AppStorage("studioSidebarExpanded") private var sidebarExpanded = true
    @AppStorage("studioDestination") private var destinationRaw = StudioDestination.home.rawValue
    @AppStorage("studioColorScheme") private var themeRaw = StudioTheme.dark.rawValue
    @AppStorage("editorLayoutMode") private var editorLayoutModeRaw = EditorLayoutMode.tallPreview.rawValue
    @AppStorage("editorTallWorkbenchFraction") private var editorTallWorkbenchFraction = 0.0
    @AppStorage("editorLayoutDefaultsVersion") private var editorLayoutDefaultsVersion = 0
    @Namespace private var sidebarSelection

    private var destination: StudioDestination {
        StudioDestination(rawValue: destinationRaw) ?? .home
    }

    private var theme: StudioTheme {
        StudioTheme(rawValue: themeRaw) ?? .dark
    }

    var body: some View {
        HStack(spacing: 0) {
            StudioSidebar(
                destination: destination,
                expanded: sidebarExpanded,
                selectionNamespace: sidebarSelection,
                onNavigate: navigate
            )
            .frame(width: sidebarExpanded ? 238 : 66)
            .animation(.smooth(duration: 0.24), value: sidebarExpanded)

            VStack(spacing: 0) {
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

                ZStack {
                    EditorRootView(session: session, embedded: true)
                        .opacity(destination == .editor ? 1 : 0)
                        .allowsHitTesting(destination == .editor)
                        .accessibilityHidden(destination != .editor)

                    // Keep one authenticated web view alive behind the native
                    // editor. Clerk refreshes its short-lived session there,
                    // and native AI uploads read the resulting Yapper cookies.
                    StudioPageView(
                        destination: destination == .editor ? .home : destination,
                        onNavigate: navigate
                    )
                    .opacity(destination == .editor ? 0 : 1)
                    .allowsHitTesting(destination != .editor)
                    .accessibilityHidden(destination == .editor)
                }
                .animation(.easeOut(duration: 0.18), value: destination)
            }
            .minFrame()
        }
        .background(Color.editorBackground)
        .onAppear {
            guard editorLayoutDefaultsVersion < 1 else { return }
            editorLayoutModeRaw = EditorLayoutMode.tallPreview.rawValue
            editorTallWorkbenchFraction = 0
            editorLayoutDefaultsVersion = 1
        }
    }

    private func navigate(_ next: StudioDestination) {
        guard next != destination else { return }
        if destination == .editor { session.pausePlayback() }
        withAnimation(.easeOut(duration: 0.18)) {
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
                            .buttonStyle(.plain)
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
        .background(Color.sidebarBackground)
        .overlay(alignment: .trailing) {
            Rectangle().fill(Color.studioLine).frame(width: 1)
        }
        .clipped()
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
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .studioGlass(radius: 8, interactive: true)
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
                        .buttonStyle(.plain)
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
                .buttonStyle(StudioTopBarSecondaryButtonStyle())
                Button {
                    ImportPanels.saveExport(for: session)
                } label: {
                    Label("Export", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(StudioTopBarPrimaryButtonStyle())
                .disabled(session.project.clips.isEmpty || session.isExporting)
            }

            NativeThemeSwitcher(theme: theme, action: toggleTheme)

            WorkspaceProfileMenu(onNavigate: onNavigate)
        }
        .padding(.horizontal, 10)
        .frame(height: 46)
        .background(.regularMaterial)
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
        .buttonStyle(.plain)
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

private struct WorkspaceProfileMenu: View {
    let onNavigate: (StudioDestination) -> Void

    var body: some View {
        Menu {
            Button("Content Library", systemImage: "square.stack.3d.up") {
                onNavigate(.library)
            }
            Button("Dictionary", systemImage: "character.book.closed") {
                onNavigate(.dictionary)
            }
            Button("Connections", systemImage: "link") {
                onNavigate(.connections)
            }
        } label: {
            HStack(spacing: 9) {
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color.yapperOrange, Color.red.opacity(0.9)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    Text("C")
                        .font(.system(size: 12, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                }
                .frame(width: 25, height: 25)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Celpip Speaking Team")
                        .font(.system(size: 12, weight: .semibold))
                }
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 8)
            .frame(height: 30)
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
        .studioGlass(radius: 10, interactive: true)
    }
}

private struct StudioTopBarPrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(.black)
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(
                Color.yapperOrange.opacity(
                    isEnabled ? (configuration.isPressed ? 0.78 : 1) : 0.35
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            .opacity(isEnabled ? 1 : 0.66)
    }
}

private struct StudioTopBarSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 11, weight: .semibold))
            .padding(.horizontal, 9)
            .frame(height: 30)
            .background(Color.studioFaintFill.opacity(configuration.isPressed ? 1.5 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .stroke(Color.studioLine, lineWidth: 1)
            }
    }
}

private extension View {
    func minFrame() -> some View {
        frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
    }
}
