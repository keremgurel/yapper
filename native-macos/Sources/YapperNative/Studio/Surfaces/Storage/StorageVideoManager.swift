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
        let origin: String?
        let platform: String?
        let retention: String?
        var id: String { mediaKey }
        var sourceLabel: String {
            switch origin {
            case "editor_export": "Editor export · Made in Yapper"
            case "upload": "Direct upload · Uploads"
            case "import": "\(platform?.capitalized ?? "Platform") cross-post import"
            default: "Recording"
            }
        }
        var retentionLabel: String {
            switch retention {
            case "editor_current": "Unpublished editor export. Kept until posted or replaced."
            case "scheduled": "Needed by a scheduled post."
            case "publishing": "Publishing is still in progress."
            case "retry": "Kept temporarily for publishing retries."
            case "cleanup": "Posted. Waiting for automatic cleanup."
            default: "Stored for reuse. You can remove this cloud copy."
            }
        }
        var protected: Bool { ["editor_current", "scheduled", "publishing"].contains(retention ?? "") }
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
            Text("Remove temporary video files from this account. Scripts, transcripts and feedback stay. Unpublished editor exports, scheduled posts and active publishing work are protected.")
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
                            StorageVideoRow(video: video, deleting: deleting) { selected = video }
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

struct StorageVideoRow: View {
    let video: StorageVideoManager.Video
    let deleting: Bool
    let onRemove: () -> Void

    var body: some View {
HStack(spacing: 12) {
                                Image(systemName: "film")
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(video.title).lineLimit(2).help(video.title)
                                    Text("\(StorageFormat.bytes(video.bytes)) · \(video.sourceLabel)").font(.system(size: 12)).foregroundStyle(.secondary)
                                    Text(video.retentionLabel).font(.system(size: 12)).foregroundStyle(.secondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                Spacer()
                                Button("Remove", role: .destructive) { onRemove() }
                                    .buttonStyle(EditorGhostButtonStyle(size: .small)).disabled(deleting || video.protected)
                            }.nativeCard(padding: 14)
    }
}
