import SwiftUI

/// Keep the editor's binding synchronous. A binding that reads a captured
/// project layer still returns the old text immediately after its setter runs;
/// TextEditor then replaces its storage and moves the insertion point.
struct TextLayerContentEditor: View {
    let text: String
    let onEdit: (String) -> Void
    /// The edit is finished: the editor lost focus or went away.
    let onCommit: () -> Void
    @State private var draft: String
    @FocusState private var focused: Bool

    init(text: String, onEdit: @escaping (String) -> Void, onCommit: @escaping () -> Void) {
        self.text = text
        self.onEdit = onEdit
        self.onCommit = onCommit
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
        .focused($focused)
        .onChange(of: focused) { _, isFocused in
            if !isFocused { onCommit() }
        }
        .onDisappear(perform: onCommit)
        .onChange(of: text) { _, value in
            // A typing echo is already present. Undo, redo and other external
            // changes still need to reach the field.
            if draft != value { draft = value }
        }
    }
}
