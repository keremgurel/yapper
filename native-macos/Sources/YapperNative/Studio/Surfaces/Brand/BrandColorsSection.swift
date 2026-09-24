import SwiftUI

/// Colors: the palette as role-labelled swatches (primary, secondary,
/// background, then accents), a card for the next empty role, and starter
/// defaults when the palette is empty.
struct BrandColorsSection: View {
    @ObservedObject var store: BrandKitStore

    var body: some View {
        NativeSection(title: "Colors", meta: store.kit.map { "\($0.colors.count) of \(BrandLimits.maxColors)" }, card: true) {
            VStack(alignment: .leading, spacing: 16) {
                Text("Click a color to change it. Drag one onto another to swap their roles. Chirpy checks contrast and picks readable combinations on its own.")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                content
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let kit = store.kit {
            if kit.colors.isEmpty { starter }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), spacing: 12)], spacing: 12) {
                ForEach(Array(kit.colors.enumerated()), id: \.element) { index, color in
                    swatch(color, index: index, count: kit.colors.count)
                }
                if kit.colors.count < BrandLimits.maxColors {
                    BrandAddColorCard(role: BrandColorRole(index: kit.colors.count), existing: kit.colors, busy: store.busy) { color in
                        Task { await store.addColor(color) }
                    }
                }
            }
        } else if store.loadFailed {
            Text("Your colors will appear when the brand kit loads.")
                .font(.system(size: 13)).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .nativeWell(padding: 20)
        } else {
            NativeLoadingState(label: "Loading colors…")
        }
    }

    private func swatch(_ color: String, index: Int, count: Int) -> some View {
        let role = BrandColorRole(index: index)
        return BrandColorSwatch(
            color: color,
            role: role,
            busy: store.busy,
            removable: role == .accent || index == count - 1,
            onChange: { next in Task { await store.replaceColor(color, with: next) } },
            onDelete: { Task { await store.removeColor(color) } }
        )
        .draggable(color)
        .dropDestination(for: String.self) { dropped, _ in
            guard let moved = dropped.first, store.colors.contains(moved), moved != color else { return false }
            Task { await store.moveColor(moved, to: color) }
            return true
        }
    }

    private var starter: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Start with safe defaults").font(.system(size: 13, weight: .semibold))
                Text("Orange primary, ink secondary, white background, and a yellow accent. Change any of them after.")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
            }
            HStack(spacing: 4) {
                ForEach(BrandLimits.starterColors, id: \.self) { hex in
                    Circle().fill(BrandHex.color(hex)).frame(width: 18, height: 18)
                        .overlay(Circle().strokeBorder(Color.studioLine, lineWidth: 1))
                }
            }
            Spacer(minLength: 0)
            Button("Use defaults", systemImage: "checkmark") {
                Task { await store.saveColors(BrandLimits.starterColors) }
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(store.busy)
        }
        .nativeWell(padding: 16)
    }
}
