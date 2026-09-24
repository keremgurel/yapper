import AppKit
import SwiftUI

/// The canvas for one idea: loads it, then composes the title bar, the
/// document, the ask field and the phone sheet. Owns the stores; every edit
/// goes through `IdeaCanvasItemStore.update` and its one autosave.
struct IdeaCanvasScreen: View {
    let onBack: () -> Void

    @StateObject private var store: IdeaCanvasItemStore
    @StateObject private var thread: IdeaCanvasThreadStore
    @StateObject private var runner: IdeaCanvasAskRunner
    @StateObject private var bar = IdeaCanvasAskBarState()
    @StateObject private var operation = IdeaCanvasOperation()
    @StateObject private var versions: IdeaCanvasVersionsStore
    /// The version on screen; the lead until the creator picks another tab.
    @State private var selection: IdeaCanvasVersionFormat?
    @State private var deleting: IdeaCanvasVersionFormat?
    @State private var phoneOpen = false
    @State private var maximize = IdeaCanvasMaximize()
    @AppStorage("studioSidebarExpanded") private var sidebarExpanded = true

    init(itemID: String, onBack: @escaping () -> Void) {
        self.onBack = onBack
        let store = IdeaCanvasItemStore(itemID: itemID)
        let thread = IdeaCanvasThreadStore(itemID: itemID)
        _store = StateObject(wrappedValue: store)
        _thread = StateObject(wrappedValue: thread)
        _runner = StateObject(wrappedValue: IdeaCanvasAskRunner(store: store, thread: thread))
        _versions = StateObject(wrappedValue: IdeaCanvasVersionsStore(itemID: itemID))
    }

    var body: some View {
        Group {
            switch store.phase {
            case .loaded: canvas
            case .loading: frame { NativeLoadingState(label: "Opening the canvas…") }
            case .failed:
                frame { NativeErrorState(message: "This idea couldn't be loaded.") { Task { await store.load() } } }
            case .missing:
                frame { NativeEmptyState(systemImage: "questionmark.folder", title: "This idea doesn't exist, or isn't yours.") }
            }
        }
        .background(Color.editorBackground)
        .task {
            await store.load()
            if let item = store.item { versions.load(item.versions) }
            await thread.load()
        }
        .onChange(of: store.item?.versions) { _, loaded in versions.load(loaded ?? []) }
        .onChange(of: current) { _, _ in runner.body = currentBody ?? store }
        .onDisappear {
            Task {
                try? await store.autosave.flush()
                try? await versions.flushAll()
            }
            if maximize.active { sidebarExpanded = maximize.restoreSidebar }
        }
    }

    private var canvas: some View {
        VStack(spacing: 0) {
            IdeaCanvasTitleBar(store: store, busy: operation.busy, maximized: maximize.active, actions: titleActions)
            IdeaCanvasProblemStrip(autosave: store.autosave, operation: operation)
            if let item = store.item {
                IdeaCanvasFormatTabs(
                    lead: item.leadFormat,
                    existing: Set([item.leadFormat] + versions.stores.keys),
                    writing: versions.writing,
                    selection: Binding(get: { current }, set: { selection = $0 }),
                    onDelete: { deleting = $0 }
                )
                .frame(maxWidth: maximize.active ? .infinity : 1440)
                .padding(.horizontal, 32)
                .frame(maxWidth: .infinity)
            }
            page
                .id(current)
        }
        .overlay(alignment: .bottom) {
            if bar.isOpen {
                IdeaCanvasAskBar(bar: bar, runner: runner, blocks: store.blocks)
                    .padding(.horizontal, 32).padding(.bottom, 20)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.snappy(duration: 0.22), value: bar.isOpen)
        .background {
            if bar.isOpen || maximize.active {
                Button("", action: escape).keyboardShortcut(.cancelAction).hidden()
            }
        }
        .confirmationDialog(
            "Delete the \(deleting?.noun ?? "version")?",
            isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                guard let format = deleting else { return }
                deleting = nil
                Task {
                    await versions.delete(format)
                    if current == format { selection = store.item?.leadFormat }
                }
            }
        } message: {
            Text("The other versions of this idea stay as they are. You can write it again later.")
        }
        .sheet(isPresented: $phoneOpen) {
            IdeaCanvasPhoneSheet(itemID: store.itemID, beforeOpen: { try await store.autosave.flush() }) {
                phoneOpen = false
            }
        }
    }

    /// The format on screen.
    private var current: IdeaCanvasVersionFormat { selection ?? store.item?.leadFormat ?? .short }

    /// What the current tab edits, or nil when that version isn't written yet.
    private var currentBody: IdeaCanvasBody? {
        guard let item = store.item else { return nil }
        if current == item.leadFormat { return store }
        return versions.stores[current]
    }

    @ViewBuilder private var page: some View {
        if let item = store.item, current == item.leadFormat {
            document(store)
        } else if let version = versions.stores[current] {
            document(version)
        } else if let item = store.item {
            IdeaCanvasVersionEmpty(
                format: current,
                sources: [item.leadFormat] + IdeaCanvasVersionFormat.allCases.filter {
                    $0 != item.leadFormat && versions.stores[$0] != nil
                },
                hasSource: item.sourceTranscript != nil || item.sourceSummary != nil,
                writing: versions.writing == current,
                error: versions.error,
                maxWidth: maximize.active ? .infinity : 1440,
                onWrite: { from in
                    let target = current
                    Task {
                        try? await store.autosave.flush()
                        try? await versions.stores[from]?.autosave.flush()
                        await versions.write(target, from: from)
                    }
                }
            )
        }
    }

    private func document<Version: IdeaCanvasBody & ObservableObject>(_ version: Version) -> some View {
        IdeaCanvasDocumentView(
            store: store,
            version: version,
            maxWidth: maximize.active ? .infinity : 1440,
            ask: runAsk,
            aim: { bar.aim(at: $0) }
        ) {
            IdeaCanvasThreadView(thread: thread, runner: runner)
            if let item = store.item, item.hasOrigin {
                IdeaCanvasFold(title: "Where this came from") { IdeaCanvasReferenceView(item: item) }
            }
        }
    }

    private func frame<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Button("Ideas", systemImage: "chevron.left", action: onBack)
                .buttonStyle(EditorGhostButtonStyle(size: .small))
            content()
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 32).padding(.top, 28)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var titleActions: IdeaCanvasTitleBarActions {
        IdeaCanvasTitleBarActions(
            back: { leave(then: onBack) },
            askChirpy: { bar.open() },
            record: {
                leave {
                    UserDefaults.standard.set(store.itemID, forKey: RecorderScriptStore.handoffKey)
                    UserDefaults.standard.set(current.rawValue, forKey: RecorderScriptStore.handoffFormatKey)
                    StudioNavigation.shared.goTo(.recorder)
                }
            },
            delete: {
                operation.run(failure: "The delete couldn't be confirmed. Your idea is kept; try again.") {
                    try await store.delete()
                    onBack()
                }
            },
            sendToPhone: { phoneOpen = true },
            copyScript: {
                guard let item = store.item else { return }
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(IdeaCanvasText.copyableScript(item), forType: .string)
            },
            editOnMac: {
                leave { StudioWebCommands.shared.openEditor(StudioEditorRequest(itemID: UUID(uuidString: store.itemID))) }
            },
            crossPost: { leave { StudioWebCommands.shared.openPoster(itemID: store.itemID) } },
            toggleMaximized: toggleMaximized
        )
    }

    /// Saves what is pending, then goes. A save that fails keeps the creator
    /// here with the reason, so no edit is left behind silently.
    private func leave(then go: @escaping () -> Void) {
        operation.run(failure: "Your latest edits couldn't be saved. Try again before leaving.") {
            try await store.autosave.flush()
            try await versions.flushAll()
            go()
        }
    }

    private func runAsk(_ instruction: String) {
        bar.open()
        Task { await runner.run(instruction) }
    }

    private func toggleMaximized() {
        withAnimation(.smooth(duration: 0.24)) {
            if maximize.active {
                sidebarExpanded = maximize.restoreSidebar
                maximize.active = false
            } else {
                maximize = IdeaCanvasMaximize(active: true, restoreSidebar: sidebarExpanded)
                sidebarExpanded = false
            }
        }
    }

    private func escape() {
        if bar.isOpen { bar.close() } else if maximize.active { toggleMaximized() }
    }
}

/// Whether the canvas has the window: the Studio sidebar collapsed and the
/// document at full width. Remembers the sidebar to put it back.
struct IdeaCanvasMaximize: Equatable {
    var active = false
    var restoreSidebar = true
}
