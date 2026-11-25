import SwiftUI

/// The sound library: one search, a row of shelves, and the sounds on the
/// picked shelf in a grid that adds columns as the pane widens.
struct SoundEffectsSection: View {
    @ObservedObject var session: EditorSession
    @State private var search = ""
    @AppStorage("soundLibraryTab") private var tabID = "all"

    private var tab: Binding<SoundLibraryTab> {
        Binding(
            get: { SoundLibraryTab.allCases.first { $0.id == tabID } ?? .all },
            set: { tabID = $0.id }
        )
    }

    private var matches: [SoundEffectDescriptor] {
        let found = AudioLibraryFilter.entries(
            AudioEntry.all(saved: []), section: .builtIn, search: search
        ).compactMap(\.effect)
        switch tab.wrappedValue {
        case .yours: return []
        case .all: return found
        case let .category(category): return found.filter { $0.category == category }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            AudioSearchField(search: $search, prompt: "Search sounds")
            SoundLibraryTabs(selection: tab)

            if tab.wrappedValue == .yours {
                WorkbenchSavedAudioShelf(session: session, store: .shared)
            } else {
                let found = matches
                if found.isEmpty {
                    noMatches
                } else {
                    LazyVGrid(columns: AudioWorkbenchMetrics.columns, alignment: .leading, spacing: AudioWorkbenchMetrics.gridSpacing) {
                        ForEach(found) { effect in
                            SoundEffectCard(session: session, effect: effect)
                        }
                    }
                }
            }
        }
    }

    private var noMatches: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(search.isEmpty ? "Nothing on this shelf yet." : "No sounds match \"\(search)\".")
                .font(.studioBodyStrong)
            if !search.isEmpty {
                Text("Try a name, description or category, such as pop, cash register or whoosh.")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                Button("Clear search") { search = "" }
                    .buttonStyle(EditorGhostButtonStyle())
                    .padding(.leading, -8)
            }
        }
        .padding(.vertical, 8)
    }
}
