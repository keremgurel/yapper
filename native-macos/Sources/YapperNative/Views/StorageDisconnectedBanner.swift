import SwiftUI

/// A strip under the top bar while a storage folder's drive is unplugged or
/// its folder is gone, wherever the creator is in the app. It names what is
/// affected and clears by itself when the drive comes back.
struct StorageDisconnectedBanner: View {
    @ObservedObject var navigation: ProjectNavigationState
    let openStorage: () -> Void
    @ObservedObject private var monitor = StorageMonitor.shared
    @State private var dismissed: Set<String> = []

    private var warnings: [StorageWarning] {
        StorageWarning.list(statuses: monitor.statuses, openProject: navigation.currentPackage)
    }

    var body: some View {
        let current = warnings
        let visible = current.filter { !dismissed.contains($0.id) }
        Group {
            if !visible.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(visible) { row($0) }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 9)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.studioDanger.opacity(0.08))
                .overlay(alignment: .bottom) { Rectangle().fill(Color.studioLine).frame(height: 1) }
                .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.18), value: visible.map(\.id))
        .onChange(of: current.map(\.id)) { _, ids in
            // A warning that cleared and comes back later is news again.
            dismissed.formIntersection(ids)
        }
    }

    private func row(_ warning: StorageWarning) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Image(systemName: warning.availability == .folderMissing ? "folder.badge.questionmark" : "externaldrive.badge.exclamationmark")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.studioDanger)
            VStack(alignment: .leading, spacing: 2) {
                Text(warning.message).font(.system(size: 12, weight: .semibold))
                if let note = warning.openProjectNote {
                    Text(note).font(.system(size: 12)).foregroundStyle(.secondary)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 12)
            if !warning.kinds.isEmpty {
                Button("Open storage settings", action: openStorage)
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            }
            Button {
                dismissed.insert(warning.id)
            } label: {
                Image(systemName: "xmark").font(.system(size: 11, weight: .semibold))
            }
            .buttonStyle(EditorGhostButtonStyle())
            .help("Dismiss")
            .accessibilityLabel("Dismiss")
        }
    }
}
