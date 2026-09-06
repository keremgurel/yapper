import SwiftUI

/// One visible, cancellable handoff shared by browser links and embedded Studio.
struct StudioEditorHandoffView: View {
    let session: EditorSession
    let signedIn: Bool
    let onOpen: () -> Void
    @ObservedObject private var commands = StudioWebCommands.shared
    @State private var failure: String?
    @State private var failedRequest: StudioEditorRequest?

    var body: some View {
        Group {
            if signedIn, commands.editorRequest?.itemID != nil || failure != nil {
                ZStack {
                    Color.black.opacity(0.28).ignoresSafeArea()
                    VStack(spacing: 16) {
                        if let failure {
                            Label("Couldn’t open the recording", systemImage: "exclamationmark.triangle")
                                .font(.headline)
                            Text(failure).multilineTextAlignment(.center)
                            HStack {
                                Button("Close") { self.failure = nil; failedRequest = nil }
                                Button("Try again") {
                                    guard let failedRequest else { return }
                                    self.failure = nil
                                    commands.openEditor(StudioEditorRequest(itemID: failedRequest.itemID))
                                }
                                .buttonStyle(EditorPrimaryButtonStyle())
                            }
                        } else {
                            ProgressView("Opening your recording…")
                            Text("Your saved take will open in its own local project.")
                                .font(.callout).foregroundStyle(.secondary)
                            Button("Cancel") {
                                if let request = commands.editorRequest { commands.finishEditorRequest(request.id) }
                            }
                        }
                    }
                    .padding(28).frame(maxWidth: 420).studioGlass(radius: 14)
                }
            }
        }
        .task(id: signedIn ? commands.editorRequest?.id : nil) {
            guard signedIn, let request = commands.editorRequest else { return }
            failure = nil
            do {
                if let itemID = request.itemID { try await session.openStudioRecording(itemID) }
                try Task.checkCancellation()
                onOpen()
            } catch is CancellationError {
                // Cancellation leaves any completed download saved as a project.
            } catch {
                if !Task.isCancelled {
                    failedRequest = request
                    failure = error.localizedDescription
                }
            }
            commands.finishEditorRequest(request.id)
        }
    }
}
