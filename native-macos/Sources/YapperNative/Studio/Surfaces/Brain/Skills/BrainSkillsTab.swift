import SwiftUI

/// The Skills tab: the creative methods Yapper follows, as a card grid.
struct BrainSkillsTab: View {
    let onDiscover: () -> Void
    let onOpen: (String) -> Void

    @ObservedObject private var store = BrainSkillsStore.shared
    @State private var creating = false
    /// Show only the skills that shape one format; nil shows them all.
    @State private var format: IdeaCanvasVersionFormat?

    private let columns = [GridItem(.adaptive(minimum: 300), spacing: 14, alignment: .top)]

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .bottom, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Skills").font(.nativeSectionTitle)
                    Text(subtitle).font(.system(size: 13)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                Button(action: onDiscover) { Label("Discover", systemImage: "magnifyingglass") }
                    .buttonStyle(EditorSecondaryButtonStyle())
                Button(action: create) { Label("Create a skill", systemImage: "plus") }
                    .buttonStyle(EditorPrimaryButtonStyle())
                    .disabled(!store.available || creating)
            }
            if let skills = store.skills, !skills.isEmpty {
                NativeSegmented(
                    options: [.init(value: nil, label: "All")]
                        + IdeaCanvasVersionFormat.allCases.map { .init(value: $0, label: $0.label, dot: $0.tone.color) },
                    selection: $format
                )
            }
            if store.saveState == .error {
                BrainInlineError(message: "A skill could not be saved. Your next edit retries it.")
            }
            if let skills = store.skills {
                if skills.isEmpty {
                    NativeEmptyState(
                        systemImage: "wand.and.stars",
                        title: "Give Yapper its first creative method",
                        message: "Browse official skills or create your own."
                    ) {
                        Button("Discover skills", action: onDiscover).buttonStyle(EditorSecondaryButtonStyle(size: .small))
                    }
                    .nativeCard()
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 14) {
                        ForEach(skills.filter { skill in format.map(skill.applies(to:)) ?? true }) { skill in
                            BrainSkillCard(
                                skill: skill,
                                removing: store.removing.contains(skill.id),
                                onToggle: { store.edit(skill.id, .enabled($0)) },
                                onOpen: { onOpen(skill.id) },
                                onRemove: { Task { await store.remove(skill.id) } }
                            )
                        }
                    }
                }
            } else if store.loading {
                NativeLoadingState(label: "Loading Skills…")
            } else {
                Text("Your Skills will appear after they load successfully.")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
            }
        }
    }

    private var subtitle: String {
        if let format {
            return "What shapes your \(format.noun): skills for it, plus the ones for every format."
        }
        let base = "Reusable methods Yapper follows when it writes with you."
        guard let skills = store.skills, !skills.isEmpty else { return base }
        return "\(base) \(store.activeCount) of \(skills.count) active."
    }

    private func create() {
        creating = true
        Task {
            defer { creating = false }
            if let skill = await store.create() { onOpen(skill.id) }
        }
    }
}
