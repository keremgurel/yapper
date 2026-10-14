import SwiftUI

/// The saved views as the hero's capsule tabs, a round button to add one,
/// and the active view's options on the right. The web's `ViewBar`.
struct IdeaViewBar: View {
    @ObservedObject var store: IdeaViewsStore = .shared

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 8) {
                tabs
                Spacer(minLength: 8)
                if let active = store.active {
                    IdeaViewOptionsButton(view: active).id(active.id)
                }
            }

            if store.failed, store.views?.isEmpty == false {
                notice("Your saved views couldn't be refreshed. Showing the last loaded views.") { Task { await store.reload() } }
            }
            if store.createFailed {
                notice("A new view couldn't be created.", danger: true) { store.create() }
            }
        }
        .padding(.bottom, 16)
    }

    @ViewBuilder
    private var tabs: some View {
        if let views = store.views, !views.isEmpty {
            NativeCapsuleTabs(
                tabs: views.map { .init(value: $0.id, label: $0.name, symbol: $0.layout.symbol) },
                selection: Binding(get: { store.active?.id ?? views[0].id }, set: { store.activeID = $0 })
            )
            Button { store.create() } label: {
                Image(systemName: "plus").font(.system(size: 14, weight: .medium))
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Color.panelBackground))
                    .overlay(Circle().strokeBorder(Color.studioLine, lineWidth: 1))
                    .contentShape(Circle())
            }
            .buttonStyle(.studioPlain)
            .clickableCursor()
            .disabled(store.creating)
            .help("New view")
            .accessibilityLabel("New view")
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

    private func notice(_ text: String, danger: Bool = false, retry: @escaping () -> Void) -> some View {
        HStack(spacing: 8) {
            Text(text).font(.system(size: 12, weight: .medium))
                .foregroundStyle(danger ? Color.studioDanger : NativeChip.Tone.yellow.color)
            Button("Try again", action: retry).buttonStyle(EditorGhostButtonStyle(size: .mini))
        }
    }
}
