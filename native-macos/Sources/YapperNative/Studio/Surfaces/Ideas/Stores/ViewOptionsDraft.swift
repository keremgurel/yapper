import Foundation

/// The edits to one view in its options popover, saved half a second after
/// the last change. Local edits stay on screen if a save fails.
@MainActor
final class ViewOptionsDraft: ObservableObject {
    enum SaveState { case idle, saving, failed }

    @Published private(set) var draft: ViewDraft
    @Published private(set) var state: SaveState = .idle
    @Published private(set) var deleting = false
    @Published private(set) var deleteFailed = false

    let viewID: String
    private let store = IdeaViewsStore.shared
    private var pending: Task<Void, Never>?

    init(view: LibraryView) {
        viewID = view.id
        draft = view.draft
    }

    func edit(_ change: (inout ViewDraft) -> Void) {
        change(&draft)
        pending?.cancel()
        pending = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(500))
            guard !Task.isCancelled else { return }
            await self?.flush()
        }
    }

    func flush() async {
        pending?.cancel()
        pending = nil
        let snapshot = draft
        guard !snapshot.name.ideasTrimmed.isEmpty else { return }
        state = .saving
        do {
            try await store.save(viewID, snapshot)
            if draft == snapshot { state = .idle }
        } catch {
            state = .failed
        }
    }

    func toggleFilter(_ key: String, _ value: String) {
        edit { draft in
            var list = draft.filters[key] ?? []
            if let index = list.firstIndex(of: value) { list.remove(at: index) } else { list.append(value) }
            draft.filters[key] = list.isEmpty ? nil : list
        }
    }

    /// An empty saved list means the defaults, so the picker starts from the
    /// resolved set and writes an explicit list once it is touched.
    var visibleColumns: [IdeaColumn] {
        draft.columns.isEmpty ? IdeaColumn.allCases : draft.columns.compactMap(IdeaColumn.init(rawValue:))
    }

    func toggleColumn(_ column: IdeaColumn) {
        var visible = visibleColumns.map(\.rawValue)
        if let index = visible.firstIndex(of: column.rawValue) { visible.remove(at: index) } else { visible.append(column.rawValue) }
        edit { $0.columns = visible }
    }

    func delete() async {
        guard !deleting else { return }
        deleting = true
        deleteFailed = false
        defer { deleting = false }
        await flush()
        do {
            try await store.remove(viewID)
        } catch {
            deleteFailed = true
        }
    }
}
