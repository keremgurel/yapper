import SwiftUI

struct ProjectStorageSummary: View {
    let listings: [ProjectListing]
    @State private var bytes: Int64 = 0

    var body: some View {
        Text("\(ProjectDiskUsage.label(bytes)) in local projects and previews")
            .font(.system(size: 12)).foregroundStyle(.secondary)
            .help("Includes source footage and generated previews. APFS copies may share disk space. Move projects to Trash to remove them; empty Trash to reclaim their space.")
            .task(id: listings) {
                let snapshot = listings
                bytes = await Task.detached(priority: .utility) {
                    snapshot.reduce(Int64(0)) { total, listing in
                        total + ProjectDiskUsage.bytes(in: listing.package.url) + ProjectDiskUsage.bytes(in: ProjectStore.directory.appending(path: "Poster renders/\(listing.summary.id.uuidString)"))
                    }
                }.value
            }
    }
}

struct ManagedMediaNotice: View {
    @ObservedObject var session: EditorSession
    var body: some View {
        if let status = session.managedMediaStatus {
            HStack(spacing: 8) {
                Image(systemName: session.managedMediaFailures.isEmpty ? "arrow.down.doc" : "exclamationmark.triangle")
                Text(status).font(.system(size: 12)).lineLimit(2).frame(maxWidth: 280, alignment: .leading).help(status)
                if !session.managedMediaFailures.isEmpty {
                    Button("Retry") { session.retryManagedMedia() }.buttonStyle(EditorGhostButtonStyle(size: .small))
                }
            }.foregroundStyle(.secondary).padding(.vertical, 4)
        }
    }
}
