import SwiftUI

/// The saved views as tabs on one hairline, with the active view's options
/// on the right.
struct IdeaViewBar: View {
    @ObservedObject var store: IdeaViewsStore = .shared

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .bottom, spacing: 2) {
                tabs
                Spacer(minLength: 8)
                if let active = store.active {
                    IdeaViewOptionsButton(view: active).id(active.id)
                        .padding(.bottom, 4)
                }
            }
            .overlay(alignment: .bottom) { Rectangle().fill(Color.studioLine).frame(height: 1) }

            if store.failed, store.views?.isEmpty == false {
                notice("Your saved views couldn't be refreshed. Showing the last loaded views.") { Task { await store.reload() } }
            }
            if store.createFailed {
                notice("A new view couldn't be created.", danger: true) { store.create() }
            }
        }
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private var tabs: some View {
        if let views = store.views, !views.isEmpty {
            ForEach(views) { view in tab(view) }
            Button { store.create() } label: {
                Image(systemName: "plus").font(.system(size: 12, weight: .medium)).frame(width: 16, height: 16)
            }
            .buttonStyle(EditorGhostButtonStyle(size: .small))
            .disabled(store.creating)
            .help("New view")
            .padding(.bottom, 4)
        } else if store.failed {
            notice("Couldn't load your saved views. Showing the default table.") { Task { await store.reload() } }
                .padding(.bottom, 8)
        } else {
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 4).fill(Color.studioFaintFill).frame(width: 80, height: 14)
                RoundedRectangle(cornerRadius: 4).fill(Color.studioFaintFill).frame(width: 64, height: 14)
            }
            .padding(.bottom, 10)
        }
    }

    private func tab(_ view: LibraryView) -> some View {
        let active = view.id == store.active?.id
        return Button { store.activeID = view.id } label: {
            HStack(spacing: 6) {
                Image(systemName: view.layout.symbol).font(.system(size: 11))
                Text(view.name).font(.system(size: 13, weight: .semibold)).lineLimit(1)
            }
            .foregroundStyle(active ? Color.primary : Color.secondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .overlay(alignment: .bottom) {
                Rectangle().fill(active ? Color.primary : Color.clear).frame(height: 2)
            }
        }
        .buttonStyle(.studioPlain)
    }

    private func notice(_ text: String, danger: Bool = false, retry: @escaping () -> Void) -> some View {
        HStack(spacing: 8) {
            Text(text).font(.system(size: 12, weight: .medium))
                .foregroundStyle(danger ? Color.studioDanger : NativeChip.Tone.yellow.color)
            Button("Try again", action: retry).buttonStyle(EditorGhostButtonStyle(size: .mini))
        }
    }
}
