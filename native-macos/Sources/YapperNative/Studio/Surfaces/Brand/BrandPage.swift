import SwiftUI

/// Brand kit: the logos and colors Chirpy uses whenever it makes graphics
/// for a video. Everything is edited in place.
struct BrandPage: View {
    @ObservedObject private var store: BrandKitStore = .shared

    var body: some View {
        NativePage() {
            NativePageHeader(
                title: "Brand kit",
                description: "Set it once. Chirpy uses these colors and logos whenever it makes graphics for your videos: numbers, charts, lower thirds and logo moments."
            ) {
                Button {
                    StudioWebCommands.shared.openAssistant(prompt: "My brand colors are ")
                } label: {
                    Label("Tell Chirpy your colors", systemImage: "sparkles")
                }
                .buttonStyle(EditorSecondaryButtonStyle())
            }

            VStack(alignment: .leading, spacing: 24) {
                if store.kit == nil && store.loadFailed {
                    NativeErrorState(message: "Your brand kit couldn't be loaded.") { Task { await store.refresh() } }
                } else if let error = store.actionError {
                    NativeErrorState(message: error)
                }
                BrandLogosSection(store: store)
                BrandColorsSection(store: store)
            }
        }
        .task { await store.refresh() }
    }
}
