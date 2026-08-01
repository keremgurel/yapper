import SwiftUI

struct AppShellView: View {
    @ObservedObject var session: EditorSession
    @AppStorage("studioSidebarExpanded") private var sidebarExpanded = true
    @AppStorage("studioDestination") private var destinationRaw = StudioDestination.home.rawValue
    @AppStorage("studioColorScheme") private var themeRaw = StudioTheme.dark.rawValue
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

                    if destination != .editor {
                        StudioPageView(
                            destination: destination,
                            session: session,
                            onNavigate: navigate
                        )
                        .id(destination)
                        .transition(
                            .asymmetric(
                                insertion: .opacity.combined(with: .offset(y: 6)),
                                removal: .opacity.combined(with: .offset(y: -3))
                            )
                        )
                    }
                }
                .animation(.easeOut(duration: 0.18), value: destination)
            }
            .minFrame()
        }
        .background(Color.editorBackground)
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
                YapperMark(size: 31)
                if expanded {
                    Text("Yapper Studio")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .lineLimit(1)
                        .transition(.opacity.combined(with: .offset(x: -4)))
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, expanded ? 15 : 17)
            .frame(height: 58)

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
    let toggleSidebar: () -> Void
    let toggleTheme: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: toggleSidebar) {
                Image(systemName: sidebarExpanded ? "sidebar.left" : "sidebar.right")
                    .font(.system(size: 14, weight: .semibold))
                    .frame(width: 32, height: 32)
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
                if session.isBusy || session.isExporting {
                    ProgressView().controlSize(.small)
                }
                Text(session.statusMessage)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Button {
                    ImportPanels.openMedia(for: session)
                } label: {
                    Label("Import", systemImage: "plus")
                }
                .buttonStyle(EditorSecondaryButtonStyle())
                Button {
                    ImportPanels.saveExport(for: session)
                } label: {
                    Label("Export", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(EditorPrimaryButtonStyle())
                .disabled(session.project.clips.isEmpty || session.isExporting)
            }

            Button(action: toggleTheme) {
                HStack(spacing: 3) {
                    ForEach(StudioTheme.allCases, id: \.rawValue) { option in
                        Image(systemName: option == .light ? "sun.max.fill" : "moon.fill")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(theme == option ? Color.yapperOrange : Color.secondary)
                            .frame(width: 27, height: 27)
                            .background {
                                if theme == option {
                                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                                        .fill(Color.studioSelectedFill)
                                }
                            }
                    }
                }
                .padding(3)
            }
            .buttonStyle(.plain)
            .studioGlass(radius: 10, tint: Color.yapperOrange.opacity(0.06), interactive: true)
            .help(theme == .dark ? "Switch to light mode" : "Switch to dark mode")

            WorkspaceProfileMenu()
        }
        .padding(.horizontal, 15)
        .frame(height: 56)
        .background(.regularMaterial)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.studioLine).frame(height: 1)
        }
    }
}

private struct WorkspaceProfileMenu: View {
    var body: some View {
        Menu {
            Button("Workspace settings", systemImage: "gearshape") {}
            Button("Connections", systemImage: "link") {}
            Divider()
            Button("Account", systemImage: "person.crop.circle") {}
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
                .frame(width: 29, height: 29)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Celpip Speaking Team")
                        .font(.system(size: 12, weight: .semibold))
                    Text("Creator workspace")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.secondary)
                }
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 8)
            .frame(height: 36)
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
        .studioGlass(radius: 10, interactive: true)
    }
}

private extension View {
    func minFrame() -> some View {
        frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
    }
}
