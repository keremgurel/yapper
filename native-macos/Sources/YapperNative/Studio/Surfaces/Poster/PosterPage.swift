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
    @State private var dropTargeted = false

    var body: some View {
        NativePage {
            VStack(alignment: .leading, spacing: 0) {
                NativePageHeader(title: "Poster") { PosterStepProgress(composing: currentActive != nil) }
                VStack(alignment: .leading, spacing: 16) {
                    PosterBanners(upload: upload, bench: bench, prep: prep, connections: connections)
                    if let active = currentActive {
                        PosterBenchView(video: active, bench: bench, upload: upload, drafts: drafts, connections: connections)
                            .id(active.id)
                    } else {
                        PosterSourcePicker(session: session, library: library, channels: channels, connections: connections,
                                           upload: upload, bench: bench, dragging: dropTargeted) { listing in
                            Task {
                                await session.performAppAction(ProjectTrashInput(projectID: listing.summary.id))
                                await library.refresh()
                            }
                        }
                    }
                }
            }
            .frame(maxWidth: 896, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .overlay {
            // The source step's own drop zone lights up instead.
            if dropTargeted && currentActive != nil {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.studioAccent, lineWidth: 2)
                    .padding(12)
                    .allowsHitTesting(false)
            }
        }
        .onDrop(of: [.fileURL], isTargeted: $dropTargeted, perform: drop)
        .task { await start() }
        .task(id: connections.connected) { await refreshChannels(force: false) }
        .onChange(of: commands.posterGeneration) { _, _ in takeHandoff() }
        .onChange(of: library.items) { _, _ in handoff.openIfReady(in: library, bench: bench) }
        .onReceive(NotificationCenter.default.publisher(for: NSWindow.didBecomeKeyNotification)) { _ in
            Task {
                await connections.refresh()
                await library.refresh()
                await refreshChannels(force: false)
            }
        }
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
        Task {
            await library.refresh()
            handoff.openIfReady(in: library, bench: bench)
        }
    }

    /// Each connected channel's shelf. The store keeps a list for a minute
    /// and the server caches it too, so this costs no extra provider calls.
    private func refreshChannels(force: Bool) async {
        await withTaskGroup(of: Void.self) { group in
            for platform in connections.connected {
                group.addTask { await channels.refresh(platform, force: force) }
            }
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
