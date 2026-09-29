import SwiftUI

/// Uses the same authenticated API transport as every other native Studio page.
struct StorageVideoManager: View {
    @Environment(\.dismiss) private var dismiss
    @State private var videos: [Video] = []
    @State private var loading = true
    @State private var error: String?
    @State private var selected: Video?
    @State private var deleting = false

    struct Video: Decodable, Identifiable {
        let mediaKey: String
        let title: String
        let bytes: Double
        var id: String { mediaKey }
    }
    private struct Reply: Decodable { let videos: [Video] }
    private struct Removal: Encodable { let mediaKey: String }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                Text("Manage videos").font(.nativeSectionTitle)
                Spacer()
                Button("Done") { dismiss() }.buttonStyle(EditorSecondaryButtonStyle())
            }
            Text("Remove temporary video files from this account. Scripts, transcripts and feedback stay. Scheduled posts and active publishing work are protected.")
                .font(.system(size: 13)).foregroundStyle(.secondary)
            if let error { Text(error).font(.system(size: 13)).foregroundStyle(Color.studioDanger) }
            if loading {
                ProgressView("Loading videos…").frame(maxWidth: .infinity, minHeight: 100)
            } else if videos.isEmpty {
                Text("No video files stored.").foregroundStyle(.secondary).frame(maxWidth: .infinity, minHeight: 100)
            } else {
                ScrollView {
                    VStack(spacing: 12) {
                        ForEach(videos) { video in
                            HStack(spacing: 12) {
                                Image(systemName: "film")
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(video.title).lineLimit(2)
                                    Text(StorageFormat.bytes(video.bytes)).font(.system(size: 12)).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Button("Remove", role: .destructive) { selected = video }
                                    .buttonStyle(EditorGhostButtonStyle(size: .small)).disabled(deleting)
                            }.nativeCard(padding: 14)
                        }
                    }
                }.frame(maxHeight: 360)
            }
            if error != nil { Button("Refresh") { Task { await load() } }.disabled(deleting) }
        }
        .padding(24)
        .frame(minWidth: 460, idealWidth: 560, maxWidth: 640)
        .task { await load() }
        .alert("Remove this video file?", isPresented: Binding(get: { selected != nil }, set: { if !$0 { selected = nil } })) {
            Button("Cancel", role: .cancel) { selected = nil }
            Button("Remove video", role: .destructive) {
                if let video = selected { Task { await remove(video) } }
                selected = nil
            }
        } message: {
            Text("The stored copy will be deleted. Keep an original on your device if you need it again. Your written work stays.")
        }
    }

    @MainActor private func load() async {
        loading = true
        defer { loading = false }
        do {
            let reply: Reply = try await StudioJSONClient.get("api/storage/videos")
            videos = reply.videos
            error = nil
        } catch {
            videos = []
            self.error = error.localizedDescription
        }
    }

    @MainActor private func remove(_ video: Video) async {
        deleting = true
        defer { deleting = false }
        do {
            try await StudioJSONClient.raw("api/storage/videos", method: "DELETE", body: try JSONEncoder().encode(Removal(mediaKey: video.mediaKey)))
            await load()
            await StorageStore.shared.refresh()
        } catch { self.error = error.localizedDescription }
    }
}
