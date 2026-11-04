import SwiftUI

/// Stands in for the grid while the projects folder's drive is unplugged or
/// the folder is gone, so missing projects never read as "No projects yet".
struct ProjectsFolderUnavailableView: View {
    let availability: StorageAvailability
    let openStorage: () -> Void

    private var title: String {
        switch availability {
        case .driveDisconnected(let name): "“\(name)” isn’t connected"
        case .folderMissing: "Your projects folder can’t be found"
        case .available: ""
        }
    }

    private var message: String {
        switch availability {
        case .driveDisconnected: "Your editor projects are saved on it. Plug it back in to see them, or choose another folder for new projects."
        case .folderMissing: "It was moved, renamed or deleted. Choose where projects should go now."
        case .available: ""
        }
    }

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: availability == .folderMissing ? "folder.badge.questionmark" : "externaldrive.badge.exclamationmark")
                .font(.system(size: 26, weight: .medium))
                .foregroundStyle(.secondary)
            Text(title).font(.system(size: 14, weight: .semibold))
            Text(message)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 380)
            Button("Open storage settings", action: openStorage)
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 80)
    }
}
