import SwiftUI

/// What the account's storage is used by and how much room each plan leaves.
struct StoragePage: View {
    let session: EditorSession
    @ObservedObject var store: StorageStore = .shared

    var body: some View {
        NativePage() {
            NativePageHeader(
                title: "Storage",
                description: "Where projects, recordings and exports are saved on your Mac, and the temporary cloud space for your current video and scheduled posts. Your written workspace stays in Yapper."
            )

            StorageFoldersSection(session: session)
            content
        }
        .task { await store.refresh() }
    }

    @ViewBuilder
    private var content: some View {
        if let usage = store.usage {
            VStack(alignment: .leading, spacing: 28) {
                if let deleteOn = usage.videosDeleteOn.flatMap({ try? Date($0, strategy: .iso8601) }) {
                    StorageLapseNotice(deleteOn: deleteOn)
                }
                Text("Cloud publishing storage counts uploaded media plus upload reservations, including expired reservations awaiting cleanup. Your Mac project files are separate and are not included in this total.")
                    .font(.studioBody).foregroundStyle(.secondary)
                Button("Open local projects") { StudioNavigation.shared.goTo(.editor) }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                StorageUsageCard(usage: usage)
                StorageMediaSection(media: usage.media)
                StorageWorkspaceCard(workspace: usage.workspace)
                StoragePlanHeadroom()
            }
        } else if let error = store.error {
            NativeErrorState(message: error) { Task { await store.refresh() } }
        } else {
            NativeLoadingState(label: "Loading your storage…")
        }
    }
}
