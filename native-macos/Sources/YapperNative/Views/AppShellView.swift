import SwiftUI

struct AppShellView: View {
    @ObservedObject var session: EditorSession
    @AppStorage("studioSidebarExpanded") private var sidebarExpanded = true
    @AppStorage("studioDestination") private var destinationRaw = StudioDestination.home.rawValue
    @Namespace private var sidebarSelection

    private var destination: StudioDestination {
        StudioDestination(rawValue: destinationRaw) ?? .home
    }

    var body: some View {
        HStack(spacing: 0) {
            StudioSidebar(
                destination: destination,
                expanded: sidebarExpanded,
                selectionNamespace: sidebarSelection,
                onNavigate: navigate
            )
            .frame(width: sidebarExpanded ? 214 : 58)
            .animation(.smooth(duration: 0.24), value: sidebarExpanded)

            VStack(spacing: 0) {
                StudioTopBar(
                    destination: destination,
                    sidebarExpanded: sidebarExpanded,
                    session: session,
                    toggleSidebar: {
                        withAnimation(.smooth(duration: 0.24)) {
                            sidebarExpanded.toggle()
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
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 7)
                        .fill(Color.yapperOrange)
                    Image(systemName: "waveform.path.ecg")
                        .font(.system(size: 13, weight: .black))
                        .foregroundStyle(.black)
                }
                .frame(width: 28, height: 28)
                if expanded {
                    Text("Yapper Studio")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .lineLimit(1)
                        .transition(.opacity.combined(with: .offset(x: -4)))
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, expanded ? 14 : 15)
            .frame(height: 52)

            Rectangle().fill(Color.white.opacity(0.07)).frame(height: 1)

            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(StudioDestination.groups, id: \.0) { group, items in
                        if !group.isEmpty, expanded {
                            Text(group.uppercased())
                                .font(.system(size: 9, weight: .bold))
                                .tracking(1.15)
                                .foregroundStyle(Color.white.opacity(0.34))
                                .padding(.top, 12)
                                .padding(.horizontal, 11)
                                .transition(.opacity)
                        } else if !group.isEmpty {
                            Spacer().frame(height: 8)
                        }

                        ForEach(items) { item in
                            Button {
                                onNavigate(item)
                            } label: {
                                HStack(spacing: 11) {
                                    Image(systemName: item.systemImage)
                                        .font(.system(size: 13, weight: .semibold))
                                        .frame(width: 20)
                                    if expanded {
                                        Text(item.title)
                                            .font(.system(size: 12, weight: .semibold))
                                            .lineLimit(1)
                                    }
                                    Spacer(minLength: 0)
                                }
                                .foregroundStyle(
                                    destination == item ? Color.white : Color.white.opacity(0.62)
                                )
                                .padding(.horizontal, expanded ? 10 : 9)
                                .frame(height: 34)
                                .contentShape(Rectangle())
                                .background {
                                    if destination == item {
                                        RoundedRectangle(cornerRadius: 7)
                                            .fill(Color.white.opacity(0.075))
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
            Rectangle().fill(Color.white.opacity(0.07)).frame(height: 1)
            HStack(spacing: 10) {
                Circle()
                    .fill(Color(red: 0.78, green: 0.20, blue: 0.08))
                    .overlay(Text("C").font(.system(size: 11, weight: .bold)))
                    .frame(width: 27, height: 27)
                if expanded {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Celpip Speaking Team")
                            .font(.system(size: 10, weight: .semibold))
                            .lineLimit(1)
                        Text("Workspace")
                            .font(.system(size: 9))
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
            }
            .padding(.horizontal, expanded ? 12 : 15)
            .frame(height: 50)
        }
        .background(Color(red: 0.045, green: 0.047, blue: 0.052))
        .overlay(alignment: .trailing) {
            Rectangle().fill(Color.white.opacity(0.07)).frame(width: 1)
        }
        .clipped()
    }
}

private struct StudioTopBar: View {
    let destination: StudioDestination
    let sidebarExpanded: Bool
    @ObservedObject var session: EditorSession
    let toggleSidebar: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Button(action: toggleSidebar) {
                Image(systemName: sidebarExpanded ? "sidebar.left" : "sidebar.right")
                    .font(.system(size: 13, weight: .semibold))
                    .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
            .foregroundStyle(.secondary)
            .background(Color.white.opacity(0.045))
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .help(sidebarExpanded ? "Collapse sidebar" : "Expand sidebar")

            Rectangle().fill(Color.white.opacity(0.09)).frame(width: 1, height: 18)
            Text(destination.title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .contentTransition(.interpolate)

            Spacer()

            if destination == .editor {
                if session.isBusy || session.isExporting {
                    ProgressView().controlSize(.small)
                }
                Text(session.statusMessage)
                    .font(.system(size: 10, weight: .medium))
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
            } else {
                Button {
                    // Account controls will connect to the existing workspace session.
                } label: {
                    HStack(spacing: 7) {
                        Circle()
                            .fill(Color(red: 0.78, green: 0.20, blue: 0.08))
                            .overlay(Text("C").font(.system(size: 10, weight: .bold)))
                            .frame(width: 24, height: 24)
                        Text("Celpip Speaking Team")
                            .font(.system(size: 10, weight: .semibold))
                        Image(systemName: "chevron.down")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(EditorSecondaryButtonStyle())
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 48)
        .background(Color.panelBackground.opacity(0.96))
        .overlay(alignment: .bottom) {
            Rectangle().fill(Color.white.opacity(0.07)).frame(height: 1)
        }
    }
}

private extension View {
    func minFrame() -> some View {
        frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
    }
}
