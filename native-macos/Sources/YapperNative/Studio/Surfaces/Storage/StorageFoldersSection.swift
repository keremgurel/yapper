import SwiftUI

/// Where each kind of file is saved on this Mac, one row per kind. Local, so it
/// shows whether or not the cloud usage below has loaded.
struct StorageFoldersSection: View {
    let session: EditorSession
    @ObservedObject private var monitor = StorageMonitor.shared
    @ObservedObject private var move = ProjectFolderMove.shared

    var body: some View {
        NativeSection(title: "Where files are saved", meta: "On this Mac or a drive you plug in", card: true) {
            VStack(spacing: 0) {
                ForEach(Array(StorageKind.allCases.enumerated()), id: \.element) { index, kind in
                    if index > 0 { Rectangle().fill(Color.studioLine).frame(height: 1) }
                    StorageFolderRow(kind: kind, session: session, monitor: monitor, move: move)
                }
            }
        }
        .onAppear { monitor.refresh(changed: false) }
    }
}
