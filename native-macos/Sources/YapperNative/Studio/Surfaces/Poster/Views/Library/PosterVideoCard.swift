import SwiftUI

/// A selectable video row with its source and date. Management actions stay
/// on the row while the browser shows the next posting action.
struct PosterVideoCard: View {
    @ObservedObject private var sync = PosterProjectSync.shared
    let video: PosterVideo
    let selected: Bool
    var onTrashProject: ((ProjectListing) -> Void)? = nil
    let onSelect: () -> Void
    @State private var confirmRemoval = false
    @State private var removing = false
    @State private var removalError: String?

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 10) {
                PosterVideoStill(video: video, iconSize: 12)
                    .frame(width: 34, height: 46)
                    .clipShape(RoundedRectangle(cornerRadius: StudioRadius.tag))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(video.title).font(.studioBodyStrong)
                        .lineLimit(2).multilineTextAlignment(.leading)
                    metadata
                }
                Spacer(minLength: 0)
            }
            .padding(6)
            .padding(.trailing, canRemove ? 36 : 0)
            .background(selected ? Color.studioSelectedFill : .clear,
                        in: RoundedRectangle(cornerRadius: StudioRadius.field))
            .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .help(video.title)
        .accessibilityAddTraits(selected ? .isSelected : [])
        .overlay(alignment: .trailing) {
            if canRemove {
                Button { confirmRemoval = true } label: {
                    Image(systemName: "xmark").font(.studioBodyStrong)
                        .foregroundStyle(Color.studioDanger).frame(width: 32, height: 32)
                        .background(Circle().fill(Color.panelBackground))
                }.buttonStyle(.studioPlain).disabled(removing).help("Remove upload")
                    .accessibilityLabel("Remove \(video.title)")
            }
        }
        .alert("Remove this upload?", isPresented: $confirmRemoval) {
            Button("Cancel", role: .cancel) { }
            Button("Remove upload", role: .destructive) {
                guard let id = video.contentItemID else { return }
                removing = true
                Task {
                    defer { removing = false }
                    do {
                        try await StudioJSONClient.delete("api/publish/uploads/\(id)")
                        await PosterLibraryStore.shared.refresh()
                    } catch { removalError = "Couldn’t remove this upload. It may still be needed for publishing or a scheduled post. Try again after it finishes." }
                }
            }
        } message: { Text("Your original file and published posts stay untouched.") }
        .alert("Upload could not be removed", isPresented: Binding(get: { removalError != nil }, set: { if !$0 { removalError = nil } })) {
            Button("OK") { removalError = nil }
        } message: { Text(removalError ?? "") }
        .contextMenu {
            if case let .project(listing) = video.origin, let onTrashProject {
                Button("Show in Finder") { ProjectPanels.revealInFinder(listing.package) }
                Button("Move project to Trash", role: .destructive) { onTrashProject(listing) }
            }
        }
    }

    private var canRemove: Bool {
        guard case let .yapper(_, id, _, _, _) = video.origin else { return false }
        return PosterLibraryStore.shared.items?.first(where: { $0.id == id })?.sourceUrl == "yapper://poster-upload"
    }

    private var metadata: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text([video.source.label, video.sourceDate?.formatted(.dateTime.month(.abbreviated).day())]
                .compactMap { $0 }.joined(separator: " · "))
            if case let .project(listing) = video.origin {
                if let status = sync.status[listing.summary.id] { Text(status) }
                else if sync.errors[listing.summary.id] != nil { Text("Preview needs attention") }
            }
        }
        .font(.studioLabel)
        .foregroundStyle(.secondary)
    }
}
