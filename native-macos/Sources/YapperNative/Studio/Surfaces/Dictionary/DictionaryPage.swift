import SwiftUI

/// The transcription dictionary: names, brands and jargon the transcriber
/// should spell the creator's way, plus the exact mishearings to correct.
struct DictionaryPage: View {
    @ObservedObject var store: DictionaryPageStore = .shared

    var body: some View {
        NativePage(maxWidth: 1080) {
            NativePageHeader(
                title: "Transcription dictionary",
                description: "Teach Yapper the names, brands, and jargon you use. Preferred spellings guide the transcriber, and saved mishearings are corrected exactly."
            )
            DictionaryAddCard(store: store)
                .padding(.bottom, 32)
            HStack(alignment: .firstTextBaseline) {
                Text("Your words").font(.nativeSectionTitle)
                Spacer(minLength: 0)
                Text("\(store.entries.count) / \(DictionaryCopy.capacity)")
                    .font(.system(size: 12).monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 12)
            list
        }
        .task { await store.refresh() }
    }

    @ViewBuilder
    private var list: some View {
        if store.loading {
            NativeLoadingState(label: "Loading your dictionary…")
        } else if let error = store.loadError, store.entries.isEmpty {
            NativeErrorState(message: error) { Task { await store.refresh() } }
        } else if store.entries.isEmpty {
            NativeEmptyState(
                systemImage: "character.book.closed",
                title: "No saved spellings yet",
                message: "Add one here, or correct a caption and choose Remember."
            )
            .nativeCard(padding: 0)
        } else {
            LazyVStack(spacing: 12) {
                ForEach(store.entries) { entry in
                    DictionaryWordRow(entry: entry, store: store)
                }
            }
        }
    }
}
