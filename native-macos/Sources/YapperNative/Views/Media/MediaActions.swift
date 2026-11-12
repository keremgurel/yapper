import SwiftUI

/// What can be done to one file, in the menu and in the context menu alike.
struct MediaActions: View {
    let session: EditorSession
    let media: ProjectMedia
    let canOverlay: Bool

    var body: some View {
        if !media.isImage {
            Button {
                Task { await session.appendMediaToTimeline(media.id) }
            } label: {
                Label("Add to main track", systemImage: "rectangle.stack.badge.plus")
            }
        }

        Button {
            Task { await session.addOverlay(media.id) }
        } label: {
            Label("Add as overlay", systemImage: "rectangle.on.rectangle")
        }
        .disabled(!canOverlay)

        // Cropping a file in the bin means every cutaway made from it: see
        // CropRequest. Offered whether or not it is on the timeline yet, and
        // says which it is rather than being greyed out for a reason nobody
        // can see from here.
        Button {
            session.beginCropping(mediaID: media.id)
        } label: {
            Label("Crop…", systemImage: "crop")
        }
        .disabled(!session.canCrop(mediaID: media.id))

        if !media.isImage {
            Divider()
            Button {
                Task { await session.resetMediaToSource(media.id) }
            } label: {
                Label("Reset this media to source", systemImage: "arrow.counterclockwise")
            }
        }

        Divider()
        Button(role: .destructive) {
            Task { await session.deleteImportedMedia(media.id) }
        } label: {
            Label("Remove from project", systemImage: "trash")
        }
    }
}
