import AppKit
import SwiftUI
import UniformTypeIdentifiers

/// The Poster: pick a video, prepare it, send it everywhere.
///
/// A source strip on top: what you made in Yapper, or what you already
/// posted on a connected channel. Below it, the grid of that source's videos
/// or, once one is open, the bench: the videos as a rail, the thumbnail in
/// the middle, the destinations on the right with the one publish button.
/// A finished video can be dropped anywhere on the page.
struct PosterPage: View {
    @ObservedObject private var library = PosterLibraryStore.shared
    @ObservedObject private var channels = PosterChannelStore.shared
    @ObservedObject private var connections = PosterConnectionStore.shared
    @ObservedObject private var upload = PosterUploadStore.shared
    @ObservedObject private var bench = PosterBench.shared
    @ObservedObject private var drafts = PosterDraftStore.shared
    @ObservedObject private var prep = PosterPublishPrep.shared
    @ObservedObject private var commands = StudioWebCommands.shared
    @ObservedObject private var handoff = PosterHandoff.shared
    @State private var source: PosterSource = .yapper
    @State private var dropTargeted = false

    var body: some View {
        NativePage {
            NativePageHeader(
                title: "Poster",
                description: "Pick a video, choose its thumbnail and captions, and send it to every channel at once."
            ) {
                Button { upload.choose() } label: {
                    Label(addLabel, systemImage: "square.and.arrow.up")
                }
                .buttonStyle(EditorSecondaryButtonStyle())
                .disabled(upload.busy)
            }
            VStack(alignment: .leading, spacing: 20) {
                PosterBanners(upload: upload, bench: bench, prep: prep, connections: connections)
                PosterSourceTabs(source: source, connected: connections.connected) { next in
                    source = next
                    bench.close()
                    Task { await refreshSource(force: false) }
                }
                content
            }
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
        .sheet(item: $prep.sheet) { request in
            PosterPublishSheet(request: request, connections: connections, drafts: drafts) { prep.sheet = nil }
        }
    }

    @ViewBuilder
    private var content: some View {
        let videos = sourceVideos
        if case let .platform(platform) = source, channels.failed.contains(platform) {
            NativeEmptyState(systemImage: "arrow.clockwise", title: "This channel couldn't be loaded",
                             message: "Check the connection and try loading its videos again.") {
                Button("Try again") { Task { await channels.refresh(platform, force: true) } }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            }
        } else if source == .yapper && library.items == nil && library.loadFailed {
            NativeEmptyState(systemImage: "arrow.clockwise", title: "Your videos could not be loaded",
                             message: "The library did not answer. Try again, or add a new export and it will open here.") {
                Button("Try again") { Task { await library.refresh() } }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            }
        } else if let active = currentActive {
            PosterBenchView(video: active, source: source, videos: videos, bench: bench, upload: upload,
                            drafts: drafts, connections: connections)
        } else {
            PosterVideoGrid(source: source, videos: videos, loading: sourceLoading, connected: sourceConnected,
                            bench: bench, upload: upload, onConnect: connections.connect)
        }
    }

    private var addLabel: String {
        switch upload.phase {
        case .uploading: "Uploading \(Int(upload.progress * 100))%"
        case .preparing: "Reading video"
        default: "Add video"
        }
    }

    private var sourceVideos: [PosterVideo] {
        switch source {
        case .yapper: library.videos
        case let .platform(platform): channels.videos(for: platform)
        }
    }

    private var sourceLoading: Bool {
        switch source {
        case .yapper: library.loading
        case let .platform(platform): channels.loading(platform)
        }
    }

    private var sourceConnected: Bool {
        if case let .platform(platform) = source { return channels.connected(platform) }
        return true
    }

    /// A library video stays current as its upload and transcript settle.
    private var currentActive: PosterVideo? {
        guard let active = bench.active else { return nil }
        guard active.submissionID != nil else { return active }
        return library.videos.first { $0.id == active.id } ?? active
    }

    private func start() async {
        upload.onAdded = { item in
            library.upsert(item)
            source = .yapper
            if item.submissionId != nil { bench.active = PosterVideo(item: item) }
        }
        upload.onUpdated = { library.upsert($0) }
        takeHandoff()
        async let connectionsLoad: Void = connections.refresh()
        async let libraryLoad: Void = library.refresh()
        _ = await (connectionsLoad, libraryLoad)
        handoff.openIfReady(in: library, bench: bench)
    }

    private func takeHandoff() {
        guard handoff.take(generation: commands.posterGeneration, itemID: commands.posterItemID) else { return }
        source = .yapper
        Task {
            await library.refresh()
            handoff.openIfReady(in: library, bench: bench)
        }
    }

    private func refreshSource(force: Bool) async {
        switch source {
        case .yapper: await library.refresh()
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
