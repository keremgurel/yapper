import SwiftUI

/// Copy properties, paste properties. The pair sits on every menu that opens on
/// something with a look worth copying, and reads the same selection wherever
/// it is opened from.
struct PropertiesMenuItems: View {
    @ObservedObject var session: EditorSession
    let item: TimelineSelectionItem

    var body: some View {
        Button {
            session.copyProperties(of: item)
        } label: {
            Label("Copy properties", systemImage: "paintbrush")
        }
        // Absent rather than disabled when the copied look belongs to another
        // kind of item: a caption's colours mean nothing to a cutaway, and a
        // greyed-out item that can never be reached is just noise.
        if let title = session.pastePropertiesTitle(for: item) {
            Button {
                session.pasteProperties(onto: item)
            } label: {
                Label(title, systemImage: "paintbrush.fill")
            }
        }
    }
}
