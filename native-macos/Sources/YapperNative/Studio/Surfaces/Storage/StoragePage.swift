import SwiftUI

/// What the account's storage is used by and how much room each plan leaves.
struct StoragePage: View {
    @ObservedObject var store: StorageStore = .shared

    var body: some View {
        NativePage() {
            NativePageHeader(
                title: "Storage",
                description: "Finished videos use your plan allowance. Your Brain, ideas and library are text and never count against it. Editor projects stay on your Mac."
            ) {
                Button {
                    StorageLinks.open(StorageLinks.pricing)
                } label: {
                    HStack(spacing: 6) {
                        Text("Compare plans")
                        Image(systemName: "arrow.up.right")
                    }
                }
                .buttonStyle(EditorSecondaryButtonStyle())
            }
            content
        }
        .task { await store.refresh() }
    }

    @ViewBuilder
    private var content: some View {
        if let usage = store.usage {
            VStack(alignment: .leading, spacing: 28) {
                StorageUsageCard(usage: usage)
                StorageMediaSection(media: usage.media)
                StorageWorkspaceCard(workspace: usage.workspace)
                StoragePlanHeadroom(usage: usage)
            }
        } else if let error = store.error {
            NativeErrorState(message: error) { Task { await store.refresh() } }
        } else {
            NativeLoadingState(label: "Loading your storage…")
        }
    }
}
