import SwiftUI

/// Capture on top, every idea below it in the saved views. Opening a row
/// shows its canvas; capturing runs the first pass and the row updates as
/// it lands.
struct IdeasListPage: View {
    @ObservedObject var store: IdeasStore = .shared
    @ObservedObject var blank: BlankIdeaCreator = .shared
    @ObservedObject var selection: IdeaSelection = .shared
    @Namespace private var composerSpace
    @State private var expanded = false
    @State private var importing = false

    var body: some View {
        ZStack {
            NativePage {
                NativePageHeader(title: "Ideas") { headerActions }
                if !expanded {
                    IdeaComposerCard(namespace: composerSpace, onExpand: toggleExpanded)
                } else {
                    Color.clear.frame(height: 96)
                }
                IdeasListBody()
                    .padding(.top, 32)
            }
            if expanded {
                IdeaComposerFullWindow(namespace: composerSpace, onCollapse: toggleExpanded)
                    .zIndex(1)
            }
        }
        .overlay(alignment: .bottom) {
            if selection.count > 0 && !expanded { IdeaBulkBar() }
        }
        .sheet(isPresented: $importing) { InstagramImportSheet() }
        .task {
            async let items: Void = store.refresh()
            async let views: Void = IdeaViewsStore.shared.reload()
            async let pillars: Void = IdeaPillarsStore.shared.refresh()
            _ = await (items, views, pillars)
        }
        .onChange(of: store.items?.map(\.id)) { _, ids in
            selection.prune(to: Set(ids ?? []))
        }
    }

    @ViewBuilder
    private var headerActions: some View {
        Button { importing = true } label: { Label("Import from Instagram", systemImage: "archivebox") }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        Button { blank.create() } label: {
            HStack(spacing: 6) {
                if blank.creating { ProgressView().controlSize(.mini) } else { Image(systemName: "plus") }
                Text("Blank")
            }
        }
        .buttonStyle(EditorSecondaryButtonStyle(size: .small))
        .disabled(blank.creating)
    }

    private func toggleExpanded() {
        withAnimation(.spring(response: 0.38, dampingFraction: 0.86)) { expanded.toggle() }
    }
}

/// Everything under the composer: alerts, then the views, filters and list.
struct IdeasListBody: View {
    @ObservedObject var store: IdeasStore = .shared
    @ObservedObject var views: IdeaViewsStore = .shared
    @ObservedObject var statuses: IdeaStatusChanges = .shared
    @ObservedObject var blank: BlankIdeaCreator = .shared
    @ObservedObject var selection: IdeaSelection = .shared
    @State private var query = ""
    @State private var pillar: String?
    @State private var sort = IdeaSort()

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            alerts
            if let error = store.loadError {
                NativeErrorState(message: "Your ideas couldn't be loaded. \(error)") { Task { await store.refresh() } }
            } else if let items = store.items {
                if items.isEmpty {
                    NativeEmptyState(
                        systemImage: "lightbulb",
                        title: "Nothing here yet",
                        message: "Write or dictate a thought above, or paste a link. It lands here with a first draft."
                    )
                } else {
                    list(items)
                }
            } else {
                IdeasListSkeleton()
            }
        }
    }

    @ViewBuilder
    private func list(_ items: [IdeaItem]) -> some View {
        let active = views.active
        let inView = IdeaGrouping.applyViewFilters(items, active?.filters ?? [:])
        let filtered = IdeaGrouping.search(inView, query: query, pillar: pillar)
        let narrowed = !query.ideasTrimmed.isEmpty || pillar != nil
        IdeaViewBar()
        IdeaFilterBar(
            query: $query,
            pillar: $pillar,
            pillarOptions: IdeaGrouping.pillarNames(inView),
            resultLabel: narrowed ? "\(filtered.count) of \(inView.count)" : nil
        )
        if active?.layout == .board {
            IdeaBoard(rows: filtered, grouping: active?.grouping, onOpen: open, onStatus: changeStatus)
        } else {
            IdeaTable(
                rows: sort.apply(filtered),
                grouping: active?.grouping,
                columns: IdeaColumn.resolve(active?.columns),
                sort: $sort,
                selection: selection,
                onOpen: open,
                onStatus: changeStatus
            )
        }
    }

    @ViewBuilder
    private var alerts: some View {
        VStack(alignment: .leading, spacing: 8) {
            if blank.failed {
                alert("A blank idea couldn't be created. Try again.", retry: nil)
            }
            if store.refreshFailed {
                alert("Your latest changes couldn't be loaded.") { Task { await store.refresh() } }
            }
            ForEach(statuses.failures.keys.sorted(), id: \.self) { id in
                alert("The status change for \(store.item(id)?.displayTitle ?? "this idea") couldn't be saved.") { statuses.retry(id) }
            }
        }
        .padding(.bottom, 12)
    }

    private func alert(_ message: String, retry: (() -> Void)?) -> some View {
        NativeErrorState(message: message, retry: retry)
    }

    private func open(_ id: String) {
        StudioNavigation.shared.openIdeaID = id
    }

    private func changeStatus(_ row: IdeaItem, _ status: IdeaStatus) {
        statuses.change(row.id, to: status)
    }
}

/// The table's shape while the first read is in flight.
struct IdeasListSkeleton: View {
    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<6, id: \.self) { index in
                HStack(spacing: 16) {
                    RoundedRectangle(cornerRadius: 4).fill(Color.studioFaintFill).frame(width: 16, height: 16)
                    RoundedRectangle(cornerRadius: 4).fill(Color.studioFaintFill).frame(width: index % 2 == 0 ? 280 : 200, height: 12)
                    Spacer()
                    RoundedRectangle(cornerRadius: 4).fill(Color.studioFaintFill).frame(width: 90, height: 12)
                }
                .padding(.horizontal, 16)
                .frame(height: 44)
                .overlay(alignment: .bottom) { Rectangle().fill(Color.studioLine).frame(height: 1) }
            }
        }
        .background(NativeCardBackground())
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
