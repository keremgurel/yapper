import SwiftUI

/// What the account's storage is used by and how much room each plan leaves.
struct StoragePage: View {
    @ObservedObject var store: StorageStore = .shared

    var body: some View {
        NativePage() {
            NativePageHeader(
                title: "Storage",
                description: "Temporary space for your current video and scheduled posts. Originals and editor projects stay on your Mac. Your written workspace stays in Yapper."
            )

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
