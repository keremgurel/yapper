import SwiftUI

/// Choose the idea this take is for. Its script goes on the teleprompter and
/// the saved take is linked to it.
struct RecorderIdeaPicker: View {
    @ObservedObject var store: RecorderIdeaListStore = .shared
    let onPick: (String) -> Void
    let onCancel: () -> Void
    @State private var query = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Pick an idea").font(.nativeSectionTitle)
                Spacer()
                Button("Cancel", action: onCancel)
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
                    .keyboardShortcut(.cancelAction)
            }
            TextField("Search your ideas", text: $query).textFieldStyle(.native)
            content.frame(maxHeight: .infinity, alignment: .top)
        }
        .padding(20)
        .frame(width: 460, height: 520)
        .background(Color.panelBackground)
        .task { await store.refresh() }
    }

    @ViewBuilder
    private var content: some View {
        if let error = store.error {
            NativeErrorState(message: error) { Task { await store.refresh() } }
        } else if store.loading {
            NativeLoadingState(label: "Loading your ideas…")
        } else {
            let rows = store.filtered(query)
            if rows.isEmpty {
                NativeEmptyState(
                    systemImage: "lightbulb",
                    title: query.isEmpty ? "No ideas yet" : "Nothing matches that",
                    message: query.isEmpty ? "Capture an idea in Ideas, then come back to record it." : nil
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 2) {
                        ForEach(rows) { row in RecorderIdeaRow(summary: row) { onPick(row.id) } }
                    }
                }
            }
        }
    }
}

private struct RecorderIdeaRow: View {
    let summary: RecorderContentSummary
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Text(summary.title.isEmpty ? "Untitled idea" : summary.title)
                    .font(.system(size: 13, weight: .medium))
                    .lineLimit(1)
                Spacer(minLength: 8)
                if summary.hasScript { NativeChip(text: "Script", tone: .neutral) }
                if summary.submissionId != nil { NativeChip(text: "Recorded", tone: .green, dot: true) }
            }
            .padding(.horizontal, 10).padding(.vertical, 9)
            .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(hovering ? Color.studioFaintFill : .clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .onHover { hovering = $0 }
    }
}
