import SwiftUI

/// Adds a spelling, with an optional mishearing to correct. Holds the page's
/// one primary action. A failed add keeps what was typed so it can be retried.
struct DictionaryAddCard: View {
    @ObservedObject var store: DictionaryPageStore
    @State private var term = ""
    @State private var alias = ""
    @State private var adding = false
    @State private var error: String?

    private var canAdd: Bool {
        !TranscriptionDictionary.key(term).isEmpty && !adding && !store.loading
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Add a spelling").font(.nativeSectionTitle)
            HStack(alignment: .bottom, spacing: 12) {
                NativeField(label: "Correct spelling") {
                    TextField("CELPIP", text: $term)
                        .textFieldStyle(.native)
                        .onSubmit(submit)
                }
                NativeField(label: "Common mishearing (optional)") {
                    TextField("Salpip", text: $alias)
                        .textFieldStyle(.native)
                        .onSubmit(submit)
                }
                Button(action: submit) {
                    HStack(spacing: 6) {
                        if adding {
                            ProgressView().controlSize(.small)
                        } else {
                            Image(systemName: "checkmark")
                        }
                        Text("Add word")
                    }
                }
                .buttonStyle(EditorPrimaryButtonStyle())
                .disabled(!canAdd)
            }
            .disabled(adding || store.loading)
            if let error {
                Text(error)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.studioDanger)
            }
        }
        .nativeCard()
    }

    private func submit() {
        guard canAdd else { return }
        adding = true
        error = nil
        Task {
            defer { adding = false }
            do {
                try await store.add(term: term, alias: alias)
                term = ""
                alias = ""
            } catch {
                self.error = DictionaryCopy.message(for: error)
            }
        }
    }
}
