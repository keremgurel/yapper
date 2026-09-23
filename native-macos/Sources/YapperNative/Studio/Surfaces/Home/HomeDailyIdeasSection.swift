import SwiftUI

/// Five prompts to start from today. A saved idea opens on its canvas; a
/// starter is captured as a new idea first, then opened.
struct HomeDailyIdeasSection: View {
    let ideas: [HomeDailyIdea]
    @StateObject private var opener = HomeIdeaOpener()

    var body: some View {
        NativeSection(title: "Five for today", meta: Date().formatted(.dateTime.month(.abbreviated).day())) {
            Button("Open Idea Bank") { StudioNavigation.shared.goTo(.ideas) }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
        } content: {
            VStack(alignment: .leading, spacing: 8) {
                if let error = opener.error {
                    Text(error).font(.system(size: 12)).foregroundStyle(Color.studioDanger)
                }
                HomeDividedList(items: Array(ideas.enumerated()).map(Numbered.init)) { entry in
                    row(entry)
                }
            }
        }
    }

    private func row(_ entry: Numbered) -> some View {
        HomeListRow(action: { Task { await opener.open(entry.idea) } }) {
            Text(String(format: "%02d", entry.index + 1))
                .font(.system(size: 11).monospacedDigit())
                .foregroundStyle(.secondary)
                .frame(width: 20, alignment: .trailing)
            Text(entry.idea.title)
                .font(.system(size: 13, weight: .medium))
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 6)
            if opener.openingTitle == entry.idea.title {
                ProgressView().controlSize(.small)
            } else {
                Image(systemName: "arrow.right").font(.system(size: 11, weight: .medium)).foregroundStyle(.secondary)
            }
        }
        .disabled(opener.openingTitle != nil)
    }

    private struct Numbered: Identifiable {
        let index: Int
        let idea: HomeDailyIdea
        var id: String { idea.id }
        init(_ pair: (offset: Int, element: HomeDailyIdea)) {
            index = pair.offset
            idea = pair.element
        }
    }
}
