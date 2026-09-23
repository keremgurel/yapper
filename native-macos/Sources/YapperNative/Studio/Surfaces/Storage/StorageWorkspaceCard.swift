import SwiftUI

/// Written work: shown for transparency, never counted against the plan.
/// Each well opens where that work lives.
struct StorageWorkspaceCard: View {
    let workspace: StorageUsage.Workspace
    @ObservedObject private var navigation = StudioNavigation.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Written workspace").font(.nativeSectionTitle)
                    Text("About \(StorageFormat.bytes(workspace.estimatedBytes)) of project, Brain, idea and library records. This is visible for transparency but does not consume your video allowance.")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: 620, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                NativeChip(text: "Included")
            }
            HStack(spacing: 12) {
                StorageWorkspaceWell(
                    symbol: "brain",
                    title: StorageFormat.count(workspace.brainBlocks, "Brain block", "Brain blocks"),
                    detail: StorageFormat.count(workspace.brainSkills, "writing skill", "writing skills")
                ) { navigation.goTo(.brain) }
                StorageWorkspaceWell(
                    symbol: "lightbulb",
                    title: StorageFormat.count(workspace.contentIdeas, "idea", "ideas"),
                    detail: "Idea bank"
                ) { navigation.goTo(.ideas) }
                StorageWorkspaceWell(
                    symbol: "books.vertical",
                    title: StorageFormat.count(workspace.contentLibrary, "library item", "library items"),
                    detail: StorageFormat.count(workspace.savedViews, "saved view", "saved views")
                ) { StorageLinks.open(StorageLinks.library) }
            }
        }
        .nativeCard(padding: 24)
    }
}

private struct StorageWorkspaceWell: View {
    let symbol: String
    let title: String
    let detail: String
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.system(size: 16))
                    .foregroundStyle(.secondary)
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(.primary)
                    Text(detail).font(.system(size: 12)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(hovering ? Color.studioFaintFill : Color.studioInputBackground)
            )
        }
        .buttonStyle(.studioPlain)
        .onHover { hovering = $0 }
    }
}
