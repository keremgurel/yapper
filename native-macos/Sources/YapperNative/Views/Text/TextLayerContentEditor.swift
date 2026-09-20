import SwiftUI

/// Keep the editor's binding synchronous. A binding that reads a captured
/// project layer still returns the old text immediately after its setter runs;
/// TextEditor then replaces its storage and moves the insertion point.
struct TextLayerContentEditor: View {
    let text: String
    let onEdit: (String) -> Void
    @State private var draft: String

    init(text: String, onEdit: @escaping (String) -> Void) {
        self.text = text
        self.onEdit = onEdit
        _draft = State(initialValue: text)
    }

    var body: some View {
        TextEditor(text: Binding(
            get: { draft },
            set: { value in
                draft = value
                onEdit(value)
            }
        ))
        .onChange(of: text) { _, value in
            // A typing echo is already present. Undo, redo and other external
            // changes still need to reach the field.
            if draft != value { draft = value }
        }
    }
}
