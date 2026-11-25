import SwiftUI

/// Poster's first step. A drop zone for a new file, then a shelf per source
/// with its recent videos, so any of them is one click from the post step.
/// The Mac app leads with Made in Yapper, where its own edits land.
struct PosterSourcePicker: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var library: PosterLibraryStore
    @ObservedObject var channels: PosterChannelStore
    @ObservedObject var connections: PosterConnectionStore
    @ObservedObject var upload: PosterUploadStore
    @ObservedObject var bench: PosterBench
    let dragging: Bool
    let onTrashProject: (ProjectListing) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 32) {
            PosterDropZone(dragging: dragging, busy: upload.busy) { upload.choose() }
            projects
            uploads
            ForEach(PublishPlatform.enabledCases) { platform in
                PosterChannelShelf(platform: platform, channels: channels, connections: connections, bench: bench)
            }
        }
    }

    private var projects: some View {
        PosterShelf(title: "Made in Yapper") {
            Image(systemName: "film.stack").font(.studioLabel).foregroundStyle(.secondary)
        } trailing: {
            ProjectStorageSummary(listings: library.projects)
        } content: {
            ManagedMediaNotice(session: session)
            if !library.projectsLoaded {
                PosterShelfSkeleton()
            } else if library.projectVideos.isEmpty {
                PosterShelfNotice(message: "Save an edit in Editor and its latest version shows up here.")
            } else {
                PosterShelfRail(videos: library.projectVideos, bench: bench, onTrashProject: onTrashProject)
            }
        }
    }

    @ViewBuilder
    private var uploads: some View {
        if library.items == nil && library.loadFailed {
            PosterShelf(title: "Your uploads") {
                Image(systemName: "square.and.arrow.up").font(.studioLabel).foregroundStyle(.secondary)
            } content: {
                PosterShelfNotice(message: "Your uploads couldn’t be loaded.") {
                    Button("Try again") { Task { await library.refresh() } }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                }
            }
        } else if !library.videos.isEmpty {
            PosterShelf(title: "Your uploads") {
                Image(systemName: "square.and.arrow.up").font(.studioLabel).foregroundStyle(.secondary)
            } content: {
                PosterShelfRail(videos: library.videos, bench: bench)
            }
        }
    }
}
