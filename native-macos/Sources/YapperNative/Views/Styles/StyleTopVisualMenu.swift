import SwiftUI

/// Swaps what a split's top area shows for another imported picture or clip.
/// Used in the Layout section and on the top visual's own overlay inspector.
struct StyleTopVisualMenu: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        let choices = session.styleTopVisualChoices
        let current = session.project.styleTopOverlay?.mediaID
        Menu {
            ForEach(choices) { media in
                Button {
                    Task { await session.replaceStyleTopVisual(with: media.id) }
                } label: {
                    if media.id == current {
                        Label(media.name, systemImage: "checkmark")
                    } else {
                        Text(media.name)
                    }
                }
            }
            if choices.isEmpty {
                Text("Import a picture or clip first")
            }
        } label: {
            Label(current == nil ? "Choose…" : "Replace…", systemImage: "photo.on.rectangle")
                .font(.studioCaption)
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.visible)
        .fixedSize()
        .help("Show another imported picture or clip in the top half")
    }
}
