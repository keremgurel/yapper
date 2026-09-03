import SwiftUI
import UniformTypeIdentifiers

/// Every project, as a grid of posters. Sits over the editor when the creator
/// asks for it and at launch when nothing is open. A dropped video becomes a
/// new project named after the file.
struct ProjectsHomeView: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var navigation: ProjectNavigationState
    @State private var listings: [ProjectListing] = []
    @State private var loaded = false
    @State private var isDropTargeted = false

    private let columns = [GridItem(.adaptive(minimum: 168, maximum: 220), spacing: 16, alignment: .top)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                if loaded, listings.isEmpty {
                    emptyState
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 20) {
                        ForEach(listings) { listing in
                            ProjectCard(
                                listing: listing,
                                isOpen: navigation.currentPackage == listing.package,
                                onOpen: { Task { await session.openProject(listing.package) } },
                                onRename: { rename(listing) },
                                onDuplicate: { Task { await session.duplicateProject(listing.package) } },
                                onReveal: { ProjectPanels.revealInFinder(listing.package) },
                                onTrash: { Task { await session.trashProject(listing.package) } }
                            )
                        }
                    }
                }
            }
            .padding(28)
            .frame(maxWidth: 1_280, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Color.editorBackground)
        .overlay {
            if isDropTargeted {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color.yapperOrange, style: StrokeStyle(lineWidth: 2, dash: [8, 6]))
                    .padding(12)
                    .allowsHitTesting(false)
            }
        }
        .onDrop(of: [.fileURL], isTargeted: $isDropTargeted) { providers in
            Task {
                let urls = await DroppedFiles.urls(from: providers)
                    .filter { UTType(filenameExtension: $0.pathExtension)?.conforms(to: .movie) ?? false }
                if !urls.isEmpty { await session.createProject(fromVideos: urls) }
            }
            return true
        }
        .task(id: navigation.libraryVersion) { await reload() }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text("Projects")
                .font(.system(size: 20, weight: .bold, design: .rounded))
            if loaded {
                Text("\(listings.count)")
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if navigation.currentPackage != nil {
                Button("Back to editor") { session.hideProjectsHome() }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            }
            Button {
                ProjectPanels.openProject(for: session)
            } label: {
                Label("Open…", systemImage: "folder")
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            Button {
                ProjectPanels.newProject(for: session)
            } label: {
                Label("New project", systemImage: "plus")
            }
            .buttonStyle(EditorPrimaryButtonStyle(size: .small))
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "film.stack")
                .font(.system(size: 26, weight: .medium))
                .foregroundStyle(.secondary)
            Text("No projects yet")
                .font(.system(size: 14, weight: .semibold))
            Text("Make one, or drop a video here and it becomes a project named after the file.")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 360)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 80)
    }

    private func rename(_ listing: ProjectListing) {
        if navigation.currentPackage != listing.package {
            Task {
                await session.openProject(listing.package)
                ProjectPanels.renameProject(for: session)
            }
        } else {
            ProjectPanels.renameProject(for: session)
        }
    }

    private func reload() async {
        listings = (try? await session.library.listings()) ?? []
        loaded = true
    }
}
