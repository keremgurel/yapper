import SwiftUI

/// The creator's own words about the idea, under the source: what they want
/// from it, the angle, the call to action. Chirpy reads it every time it
/// writes, so it can be added to or corrected here after capture.
struct IdeaCanvasNoteCard: View {
    let item: IdeaCanvasItem
    let update: (IdeaCanvasPatch) -> Void

    @State private var editing = false
    @State private var expanded = false
    @State private var focusRequest = 0

    private static let foldLines = 8
    private var note: String { item.originalNote.trimmingCharacters(in: .whitespacesAndNewlines) }
    /// Long enough that the folded card hides some of it.
    private var isLong: Bool { note.count > 420 || note.filter(\.isNewline).count >= Self.foldLines }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            IdeaCanvasSectionTitle("Your note", meta: "Chirpy reads this") {
                if editing || !note.isEmpty {
                    Button(editing ? "Done" : "Edit") { toggleEditing() }
                        .buttonStyle(EditorGhostButtonStyle(size: .mini))
                }
            }
            VStack(alignment: .leading, spacing: 10) {
                if editing {
                    IdeaCanvasGrowingEditor(
                        text: Binding(
                            get: { item.originalNote },
                            set: { update(IdeaCanvasNoteEdit.patch(note: $0, ideaType: item.ideaType)) }
                        ),
                        placeholder: "The angle, what to keep from the source, how it should end.",
                        font: .system(size: 13),
                        lineSpacing: 3,
                        minHeight: 80,
                        focusRequest: focusRequest
                    )
                } else if note.isEmpty {
                    Text("Say what you want from this idea: the angle, what to keep from the source, the call to action. Chirpy uses it every time it writes.")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Button("Add a note") { toggleEditing() }
                        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                } else {
                    Text(note)
                        .font(.system(size: 13)).lineSpacing(3)
                        .foregroundStyle(Color.primary.opacity(0.85))
                        .lineLimit(expanded ? nil : Self.foldLines)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                    if isLong {
                        Button(expanded ? "Show less" : "Show all") { expanded.toggle() }
                            .buttonStyle(.studioPlain)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.studioFaintFill))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
        }
    }

    private func toggleEditing() {
        editing.toggle()
        if editing { focusRequest += 1 }
    }
}
