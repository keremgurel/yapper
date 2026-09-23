import SwiftUI
import UniformTypeIdentifiers

/// Logos: a grid of cards, an upload button, and a drop target covering the
/// whole section so a file can land anywhere on it.
struct BrandLogosSection: View {
    @ObservedObject var store: BrandKitStore
    @State private var dropping = false

    var body: some View {
        NativeSection(title: "Logos", card: true) {
            Button {
                if let file = BrandFilePicker.chooseLogo() { Task { await store.uploadLogo(file) } }
            } label: {
                Label(store.busy ? "Working…" : "Upload logo", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(EditorPrimaryButtonStyle(size: .small))
            .disabled(!store.canAddLogo)
        } content: {
            VStack(alignment: .leading, spacing: 16) {
                Text("Add light, dark, icon, or wordmark versions. Mark the one Chirpy should reach for first. Drop a file anywhere here to add it.")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                content
            }
        }
        .overlay {
            if dropping {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.studioSelectedFill)
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color.yapperOrange, lineWidth: 1.5))
                    .allowsHitTesting(false)
            }
        }
        .onDrop(of: [.fileURL], isTargeted: $dropping) { providers in
            guard store.canAddLogo, let provider = providers.first else { return false }
            _ = provider.loadObject(ofClass: URL.self) { url, _ in
                guard let url else { return }
                Task { @MainActor in await store.uploadLogo(url) }
            }
            return true
        }
    }

    @ViewBuilder
    private var content: some View {
        if store.kit == nil {
            if store.loadFailed {
                Text("Your logos will appear when the brand kit loads.")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .nativeWell(padding: 20)
            } else {
                NativeLoadingState(label: "Loading your brand kit…")
            }
        } else if store.logos.isEmpty {
            emptyDropZone
        } else {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 16)], spacing: 16) {
                ForEach(store.logos) { logo in
                    BrandLogoCard(
                        logo: logo,
                        busy: store.busy,
                        onPrimary: { Task { await store.makePrimary(logo: logo) } },
                        onDelete: { Task { await store.deleteLogo(logo) } }
                    )
                }
            }
        }
    }

    private var emptyDropZone: some View {
        Button {
            if let file = BrandFilePicker.chooseLogo() { Task { await store.uploadLogo(file) } }
        } label: {
            VStack(spacing: 8) {
                Image(systemName: "photo.badge.plus")
                    .font(.system(size: 18))
                    .foregroundStyle(.secondary)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Color.panelBackground))
                Text("Drop a logo here").font(.system(size: 13, weight: .semibold))
                Text("PNG, JPG, WebP, or SVG, up to 5 MB").font(.system(size: 12)).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 36)
            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.studioInputBackground))
        }
        .buttonStyle(.studioPlain)
        .disabled(store.busy)
    }
}
