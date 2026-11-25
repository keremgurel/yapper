import SwiftUI

struct PosterSourcePicker: View {
    @Binding var source: PosterSource
    @Binding var query: String
    @Binding var selectedID: String?
    @ObservedObject var library: PosterLibraryStore
    @ObservedObject var channels: PosterChannelStore
    @ObservedObject var connections: PosterConnectionStore
    let dragging: Bool
    let uploadBusy: Bool
    let onChooseFile: () -> Void
    let onOpen: (PosterVideo) -> Void
    let onTrashProject: (ProjectListing) -> Void
    @FocusState private var searchFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            search
            PosterSourceTabs(source: $source)
            if source == .all {
                PosterDropZone(dragging: dragging, busy: uploadBusy, onChoose: onChooseFile)
            }
            sourceContent
        }
        .onChange(of: source) { _, _ in selectedID = nil }
    }

    private var search: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary).accessibilityHidden(true)
            TextField("Search video titles", text: $query)
                .textFieldStyle(.plain)
                .focused($searchFocused)
            if !query.isEmpty {
                Button { query = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                }
                .buttonStyle(.studioPlain)
                .accessibilityLabel("Clear search")
                .help("Clear search")
            }
        }
        .font(.studioBody)
        .padding(.horizontal, 12)
        .frame(height: 38)
        .background(Color.studioInputBackground, in: RoundedRectangle(cornerRadius: StudioRadius.field))
        .overlay(
            RoundedRectangle(cornerRadius: StudioRadius.field)
                .strokeBorder(searchFocused ? Color.studioAccent.opacity(0.55) : Color.studioLine)
                .allowsHitTesting(false)
        )
    }

    @ViewBuilder
    private var sourceContent: some View {
        let recent = PosterVideo.browse(videos, in: source, matching: query)
        if case .platform = source, !connections.hasLoaded {
            if connections.failed {
                NativeErrorState(message: "Couldn’t check your connected accounts.") {
                    Task { await connections.refresh() }
                }
            } else {
                NativeLoadingState(label: "Checking connection…")
            }
        } else if case let .platform(platform) = source, !connections.connected.contains(platform) {
            NativeEmptyState(systemImage: "link", title: "Connect \(platform.label)",
                             message: "Connect your account to reuse its videos in Poster.") {
                Button("Connect \(platform.label)") { connections.connect(platform) }
                    .buttonStyle(EditorSecondaryButtonStyle())
            }
        } else {
            ViewThatFits(in: .horizontal) {
                HStack {
                    heading.fixedSize()
                    Spacer(minLength: 12)
                    if source == .yapper { ProjectStorageSummary(listings: library.projects).fixedSize() }
                }
                VStack(alignment: .leading, spacing: 4) {
                    heading
                    if source == .yapper { ProjectStorageSummary(listings: library.projects) }
                }
            }
            if recent.isEmpty {
                emptyState
            } else {
                PosterVideoBrowser(videos: recent, source: source, query: query, selectedID: $selectedID,
                                   onOpen: onOpen, onTrashProject: onTrashProject)
            }
            if let error = loadError {
                NativeErrorState(message: error) {
                    Task { await retry() }
                }
            }
        }
    }

    private var heading: some View {
        Text(source == .all ? "Recent videos" : source.label)
            .font(.nativeSectionTitle)
            .accessibilityAddTraits(.isHeader)
    }

    @ViewBuilder
    private var emptyState: some View {
        if loading {
            NativeLoadingState(label: "Loading videos…")
        } else if loadError == nil {
            if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                NativeEmptyState(systemImage: "magnifyingglass", title: "No videos match your search") {
                    Button("Clear search") { query = "" }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                }
            } else {
                switch source {
                case .all:
                    NativeEmptyState(systemImage: "film", title: "No recent videos",
                                     message: "Upload a video, save an edit, or connect a channel to get started.")
                case .yapper:
                    NativeEmptyState(systemImage: "film", title: "Your edited projects appear here",
                                     message: "Save an edit in Editor to prepare it in Poster.")
                case .uploads:
                    NativeEmptyState(systemImage: "film", title: "No uploads yet") {
                        Button("Upload a video", action: onChooseFile)
                            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                            .disabled(uploadBusy)
                    }
                case let .platform(platform):
                    NativeEmptyState(systemImage: "film", title: "No \(platform.label) videos yet",
                                     message: "Videos from your connected account will appear here.")
                }
            }
        }
    }

    private var videos: [PosterVideo] {
        switch source {
        case .all:
            library.projectVideos + uploads + connections.connected.flatMap { channels.videos(for: $0) }
        case .yapper: library.projectVideos
        case .uploads: uploads
        case let .platform(platform): channels.videos(for: platform)
        }
    }

    private var uploads: [PosterVideo] {
        library.belongsToCurrentAccount ? library.videos : []
    }

    private var loading: Bool {
        switch source {
        case .all:
            !library.projectsLoaded || library.loading ||
                (!connections.failed && !connections.hasLoaded) || connections.connected.contains(where: channels.loading)
        case .yapper: !library.projectsLoaded
        case .uploads: library.loading
        case let .platform(platform): channels.loading(platform)
        }
    }

    private var loadError: String? {
        switch source {
        case .all:
            let failedChannels = connections.connected.contains { channels.failed.contains($0) }
            if library.loadFailed || connections.failed || failedChannels { return "Some sources couldn’t be loaded." }
        case .uploads:
            if library.loadFailed { return "Your uploads couldn’t be loaded." }
        case let .platform(platform):
            if channels.failed.contains(platform) { return "\(platform.label) videos couldn’t be loaded." }
        case .yapper: break
        }
        return nil
    }

    private func retry() async {
        switch source {
        case .all:
            await connections.refresh()
            async let local: Void = library.refresh()
            for platform in connections.connected where channels.failed.contains(platform) {
                await channels.refresh(platform, force: true)
            }
            await local
        case .uploads, .yapper:
            await library.refresh()
        case let .platform(platform):
            await channels.refresh(platform, force: true)
        }
    }
}
