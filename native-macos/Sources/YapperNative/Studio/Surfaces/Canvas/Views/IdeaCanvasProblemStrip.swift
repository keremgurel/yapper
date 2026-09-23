import SwiftUI

/// A strip under the title bar when something needs the creator: an action
/// that failed, or edits that could not be saved, with the way to retry.
struct IdeaCanvasProblemStrip: View {
    @ObservedObject var autosave: IdeaCanvasAutosave
    @ObservedObject var operation: IdeaCanvasOperation

    var body: some View {
        if operation.error != nil || autosave.state == .error {
            HStack(spacing: 12) {
                if let error = operation.error {
                    Text(error).font(.system(size: 13)).foregroundStyle(Color.studioDanger)
                } else {
                    Text("Your edits couldn't be saved yet.").font(.system(size: 13)).foregroundStyle(Color.studioDanger)
                }
                Spacer(minLength: 0)
                if autosave.state == .error {
                    Button("Retry saving") {
                        Task {
                            do { try await autosave.flush() } catch {
                                operation.error = "Your edits still couldn't be saved. Try again."
                            }
                        }
                    }
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                }
                if operation.error != nil {
                    Button("Dismiss") { operation.error = nil }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                }
            }
            .padding(.horizontal, 20).padding(.vertical, 8)
            .background(Color.studioDanger.opacity(0.08))
            .overlay(alignment: .bottom) { Rectangle().fill(Color.studioLine).frame(height: 1) }
        }
    }
}
