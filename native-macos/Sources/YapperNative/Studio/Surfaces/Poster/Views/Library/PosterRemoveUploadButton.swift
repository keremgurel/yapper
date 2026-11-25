import SwiftUI

/// The red X on a Poster upload: confirm, remove, and say so if the server
/// refused because the upload is still needed.
struct PosterRemoveUploadButton: View {
    let video: PosterVideo
    @State private var confirmRemoval = false
    @State private var removing = false
    @State private var removalError: String?

    /// Only uploads made in Poster can be removed from here.
    static func canRemove(_ video: PosterVideo) -> Bool {
        guard case let .yapper(_, id, _, _, _) = video.origin else { return false }
        return PosterLibraryStore.shared.items?.first(where: { $0.id == id })?.sourceUrl == "yapper://poster-upload"
    }

    var body: some View {
        Button { confirmRemoval = true } label: {
            Image(systemName: "xmark").font(.studioCaptionStrong)
                .foregroundStyle(Color.studioDanger).frame(width: 26, height: 26)
                .background(Circle().fill(Color.panelBackground))
                .overlay(Circle().strokeBorder(Color.studioLine, lineWidth: 0.5))
        }
        .buttonStyle(.studioPlain).disabled(removing).help("Remove upload")
        .accessibilityLabel("Remove \(video.title)")
        .alert("Remove this upload?", isPresented: $confirmRemoval) {
            Button("Cancel", role: .cancel) { }
            Button("Remove upload", role: .destructive) { remove() }
        } message: { Text("Your original file and published posts stay untouched.") }
        .alert("Upload could not be removed", isPresented: Binding(get: { removalError != nil }, set: { if !$0 { removalError = nil } })) {
            Button("OK") { removalError = nil }
        } message: { Text(removalError ?? "") }
    }

    private func remove() {
        guard let id = video.contentItemID else { return }
        removing = true
        Task {
            defer { removing = false }
            do {
                try await StudioJSONClient.delete("api/publish/uploads/\(id)")
                await PosterLibraryStore.shared.refresh()
            } catch {
                removalError = "Couldn’t remove this upload. It may still be needed for publishing or a scheduled post. Try again after it finishes."
            }
        }
    }
}
