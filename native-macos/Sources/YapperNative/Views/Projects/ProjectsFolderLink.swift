import SwiftUI

/// Which folder the grid is showing, beside its size, with the way to change it.
struct ProjectsFolderLink: View {
    let openStorage: () -> Void
    @ObservedObject private var monitor = StorageMonitor.shared

    var body: some View {
        let folder = StorageFolders.standard.folder(for: .editorProjects)
        HStack(spacing: 6) {
            Text("·").foregroundStyle(.tertiary)
            Text("in \((folder.path as NSString).abbreviatingWithTildeInPath)")
                .lineLimit(1)
                .truncationMode(.middle)
                .foregroundStyle(.secondary)
                .help(folder.path)
            Button("Change", action: openStorage)
                .buttonStyle(.studioPlain)
                .foregroundStyle(Color.yapperOrange)
        }
        .font(.system(size: 12))
        .id(monitor.generation)
    }
}
