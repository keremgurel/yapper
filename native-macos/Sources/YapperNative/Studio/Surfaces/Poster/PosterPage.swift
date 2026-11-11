import AppKit
import SwiftUI
import UniformTypeIdentifiers

/// Source selection and composition share the same Studio frame.
struct PosterPage: View {
    @ObservedObject var session: EditorSession
    @ObservedObject private var library = PosterLibraryStore.shared
    @ObservedObject private var channels = PosterChannelStore.shared
    @ObservedObject private var connections = PosterConnectionStore.shared
    @ObservedObject private var upload = PosterUploadStore.shared
    @ObservedObject private var bench = PosterBench.shared
    @ObservedObject private var drafts = PosterDraftStore.shared
    @ObservedObject private var prep = PosterPublishPrep.shared
    @ObservedObject private var commands = StudioWebCommands.shared
    @ObservedObject private var handoff = PosterHandoff.shared
    @State private var source: PosterSource = .uploads
    @State private var dropTargeted = false

    var body: some View {
        NativePage {
            VStack(alignment: .leading, spacing: 0) {
                NativePageHeader(title: "Poster") { PosterStepProgress(composing: currentActive != nil) }
                VStack(alignment: .leading, spacing: 16) {
                    PosterBanners(upload: upload, bench: bench, prep: prep, connections: connections)
                    if currentActive == nil {
                        Text("Choose a source").font(.nativeSectionTitle)
                        PosterSourceOptions(selected: source, connected: connections.connected, uploadBusy: upload.busy, onUpload: {
                            source = .uploads
                            upload.choose()
                        }, onChoose: { next in
                            source = next
                            Task { await refreshSource(force: false) }
                        })
                        if !sourceVideos.isEmpty || source == .yapper {
                            Divider()
                            HStack {
                                Text(sourceLabel).font(.nativeSectionTitle)
                                Spacer()
                                if source == .yapper { ProjectStorageSummary(listings: library.projects) }
                            }
                        }
                        if source == .yapper { ManagedMediaNotice(session: session) }
                    }
                    content
                }
            }
            .frame(maxWidth: 896, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .overlay {
            if dropTargeted {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.yapperOrange, lineWidth: 2)
                    .padding(12)
                    .allowsHitTesting(false)
            }
        }
        .onDrop(of: [.fileURL], isTargeted: $dropTargeted, perform: drop)
        .task { await start() }
        .onChange(of: commands.posterGeneration) { _, _ in takeHandoff() }
        .onChange(of: library.items) { _, _ in handoff.openIfReady(in: library, bench: bench) }
        .onReceive(NotificationCenter.default.publisher(for: NSWindow.didBecomeKeyNotification)) { _ in
            Task {
                await connections.refresh()
                await refreshSource(force: true)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        let videos = sourceVideos
        if let active = currentActive {
            PosterBenchView(video: active, bench: bench, upload: upload, drafts: drafts, connections: connections)
                .id(active.id)
        } else if case let .platform(platform) = source, connections.connected.contains(platform), channels.failed.contains(platform) {
            NativeEmptyState(systemImage: "arrow.clockwise", title: "This channel couldn't be loaded",
                             message: "Check the connection and try loading its videos again.") {
                Button("Try again") { Task { await channels.refresh(platform, force: true) } }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            }
        } else if source == .uploads && library.items == nil && library.loadFailed {
            NativeEmptyState(systemImage: "arrow.clockwise", title: "Your videos could not be loaded",
                             message: "The library did not answer. Try again, or add a new export and it will open here.") {
                Button("Try again") { Task { await library.refresh() } }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            }
        } else {
            PosterVideoGrid(source: source, videos: videos, loading: sourceLoading, connected: sourceConnected,
                            bench: bench, upload: upload, onConnect: connections.connect, onTrashProject: { listing in
                                Task {
                                    await session.performAppAction(ProjectTrashInput(projectID: listing.summary.id))
                                    await library.refresh()
                                }
                            })
        }
    }

    private var sourceLabel: String {
        switch source {
        case .yapper: "Made in Yapper"
        case .uploads: "Ready to post"
        case let .platform(platform): "Recent \(platform.label) posts"
        }
    }

    private var sourceVideos: [PosterVideo] {
        switch source {
        case .yapper: library.projectVideos
        case .uploads: library.videos
        case let .platform(platform): channels.videos(for: platform)
        }
    }

    private var sourceLoading: Bool {
        switch source {
        case .yapper: !library.projectsLoaded
        case .uploads: library.loading
        case let .platform(platform): channels.loading(platform)
        }
    }

    private var sourceConnected: Bool {
        if case let .platform(platform) = source { return connections.connected.contains(platform) }
        return true
    }

    /// A library video stays current as its upload and transcript settle.
    private var currentActive: PosterVideo? {
        guard let active = bench.active else { return nil }
        guard active.submissionID != nil else { return active }
        return library.videos.first { $0.id == active.id } ?? active
    }

    private func start() async {
        upload.onDiscarded = { Task { await library.refresh() } }
        upload.onSelected = { video in
            source = .uploads
            bench.close()
            bench.active = video
        }
        upload.onAdded = { item in
            library.upsert(item)

        }
        upload.onUpdated = { item in
            library.upsert(item)
            bench.apply(item)
        }
        takeHandoff()
        async let connectionsLoad: Void = connections.refresh()
        async let libraryLoad: Void = library.refresh()
        _ = await (connectionsLoad, libraryLoad)
        handoff.openIfReady(in: library, bench: bench)
    }

    private func takeHandoff() {
        guard handoff.take(generation: commands.posterGeneration, itemID: commands.posterItemID) else { return }
        source = .uploads
        Task {
            await library.refresh()
            handoff.openIfReady(in: library, bench: bench)
        }
    }

    private func refreshSource(force: Bool) async {
        switch source {
        case .yapper, .uploads: await library.refresh()
        case let .platform(platform): await channels.refresh(platform, force: force)
        }
    }

    private func drop(_ providers: [NSItemProvider]) -> Bool {
        let files = providers.filter { $0.canLoadObject(ofClass: URL.self) }
        guard !files.isEmpty else { return false }
        Task {
            var urls: [URL] = []
            for provider in files {
                if let url = await Self.loadURL(provider) { urls.append(url) }
            }
            upload.add(urls)
        }
        return true
    }

    private static func loadURL(_ provider: NSItemProvider) async -> URL? {
        await withCheckedContinuation { continuation in
            _ = provider.loadObject(ofClass: URL.self) { url, _ in continuation.resume(returning: url) }
        }
    }
}
