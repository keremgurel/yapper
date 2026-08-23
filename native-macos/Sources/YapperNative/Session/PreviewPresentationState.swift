import Foundation

/// Whether the editor's existing player is being presented by itself.
///
/// This lives apart from `EditorSession`'s published project state: entering
/// fullscreen is a window concern and must not invalidate the timeline,
/// transcript, captions, or composition.
@MainActor
final class PreviewPresentationState: ObservableObject {
    @Published private(set) var isFullScreen = false

    func enterFullScreen() {
        guard !isFullScreen else { return }
        isFullScreen = true
    }

    func exitFullScreen() {
        guard isFullScreen else { return }
        isFullScreen = false
    }

    func toggleFullScreen() {
        isFullScreen ? exitFullScreen() : enterFullScreen()
    }
}
