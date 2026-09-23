import AVKit
import SwiftUI

/// After a take: play it back, then save it to the library, retake it, or
/// download it. A saved take opens straight into the Mac editor.
struct RecorderReviewView: View {
    let take: RecorderTake
    let itemID: String?
    let title: String?
    @ObservedObject var saving: RecorderSaveState
    let onRetake: () -> Void

    @State private var player: AVPlayer?
    @State private var downloadError: String?

    var body: some View {
        HStack(alignment: .top, spacing: 28) {
            VideoPlayer(player: player)
                .aspectRatio(9.0 / 16.0, contentMode: .fit)
                .frame(height: 620)
                .background(Color.black)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
            actions.frame(width: 340, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, alignment: .top)
        .onAppear { player = AVPlayer(url: take.url) }
        .onDisappear { player?.pause() }
        .onChange(of: take) { _, next in player = AVPlayer(url: next.url) }
    }

    private var actions: some View {
        NativeSection(title: "Your take", meta: title, card: true) {
            VStack(alignment: .leading, spacing: 12) {
                Text(itemID == nil
                     ? "Save it to your library to edit and post it. It becomes a new library item."
                     : "Save it to your library to link it to this idea, then edit and post it.")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                saveButton
                if let saved = saving.savedItemID { savedActions(saved) }
                if case let .failed(error) = saving.phase {
                    Text(error.message).font(.system(size: 12, weight: .medium)).foregroundStyle(Color.studioDanger)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let downloadError {
                    Text(downloadError).font(.system(size: 12, weight: .medium)).foregroundStyle(Color.studioDanger)
                }
                HStack(spacing: 8) {
                    Button { player?.pause(); onRetake() } label: {
                        Label("Retake", systemImage: "arrow.counterclockwise").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(EditorSecondaryButtonStyle())
                    .disabled(saving.isSaving)
                    Button { downloadError = RecorderDownload.save(take) } label: {
                        Label("Download", systemImage: "arrow.down.to.line").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(EditorSecondaryButtonStyle())
                }
            }
        }
    }

    private var saveButton: some View {
        Button {
            Task { await saving.save(take, itemID: itemID, title: title) }
        } label: {
            HStack(spacing: 8) {
                if saving.isSaving {
                    ProgressView().controlSize(.small)
                } else {
                    Image(systemName: saving.savedItemID == nil ? "tray.and.arrow.up" : "checkmark")
                }
                Text(saving.isSaving ? "Saving to library…" : saving.savedItemID == nil ? "Save to library" : "Saved to library")
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(EditorPrimaryButtonStyle())
        .disabled(saving.isSaving || saving.savedItemID != nil)
    }

    private func savedActions(_ id: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                player?.pause()
                StudioWebCommands.shared.openEditor(StudioEditorRequest(itemID: UUID(uuidString: id)))
            } label: {
                Label("Edit on Mac", systemImage: "scissors").frame(maxWidth: .infinity)
            }
            .buttonStyle(EditorSecondaryButtonStyle())
            Button("Open the idea") { StudioNavigation.shared.openIdea(id) }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
        }
    }
}
