import SwiftUI

/// Colors: the palette as swatches (first is primary, drag to reorder), a
/// row to add one, and starter defaults when the palette is empty.
struct BrandColorsSection: View {
    @ObservedObject var store: BrandKitStore

    var body: some View {
        NativeSection(title: "Colors", meta: store.kit.map { "\($0.colors.count) of \(BrandLimits.maxColors)" }, card: true) {
            VStack(alignment: .leading, spacing: 16) {
                Text("The first swatch is primary; drag a swatch to reorder. Chirpy checks contrast and chooses readable combinations automatically.")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                content
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if let kit = store.kit {
            if kit.colors.isEmpty {
                starter
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), spacing: 12)], spacing: 12) {
                    ForEach(Array(kit.colors.enumerated()), id: \.element) { index, color in
                        swatch(color, primary: index == 0)
                    }
                }
            }
            if kit.colors.count < BrandLimits.maxColors {
                BrandAddColorRow(existing: kit.colors, disabled: store.busy) { color in
                    Task { await store.addColor(color) }
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

    private func swatch(_ color: String, primary: Bool) -> some View {
        BrandColorSwatch(
            color: color,
            primary: primary,
            busy: store.busy,
            onChange: { next in Task { await store.replaceColor(color, with: next) } },
            onPrimary: { Task { await store.makePrimary(color: color) } },
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
                Text("Yapper orange, ink, white, and highlight yellow make a readable starter palette.")
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
