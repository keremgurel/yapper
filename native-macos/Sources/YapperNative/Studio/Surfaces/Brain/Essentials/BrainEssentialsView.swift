import SwiftUI

/// The Essentials tab: the fields Yapper reads on every call, then what it
/// actually sees.
struct BrainEssentialsView: View {
    @ObservedObject private var store = BrainProjectStore.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            if let project = store.project {
                BrainEssentialsCard(project: project, store: store)
            } else if store.loading {
                NativeLoadingState(label: "Loading your Essentials…")
            } else {
                NativeErrorState(message: "Your Essentials could not be loaded.") {
                    Task { await store.retry() }
                }
            }
            BrainWhatYapperReads()
        }
    }
}

/// The Essentials, edited in place on one card. Two columns so the fields
/// read as a form, not a scroll. Every change autosaves.
struct BrainEssentialsCard: View {
    let project: BrainProject
    @ObservedObject var store: BrainProjectStore

    private let columns = [GridItem(.flexible(), spacing: 20, alignment: .top), GridItem(.flexible(), spacing: 20, alignment: .top)]

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("About you").font(.nativeSectionTitle)
                    Text("Read before anything is written for you. Plain sentences are fine.")
                        .font(.system(size: 13)).foregroundStyle(.secondary)
                    BrainEssentialsFitNote(project: project)
                }
                Spacer(minLength: 0)
                BrainSaveNote(state: store.saveState)
            }
            NativeField(label: "What you call this") {
                TextField("My channel", text: Binding(get: { project.name }, set: { store.update(.name($0)) }))
                    .textFieldStyle(NativeTextFieldStyle(size: 14))
                    .frame(maxWidth: 380)
            }
            NativeField(label: "Default format") {
                VStack(alignment: .leading, spacing: 6) {
                    NativeSegmented.formats(selection: Binding(
                        get: { project.defaultFormat ?? .short },
                        set: { store.update(.defaultFormat($0)) }
                    ))
                    Text("New ideas start in this format. You can make the other formats from any idea later.")
                        .font(.system(size: 12)).foregroundStyle(.secondary)
                }
            }
            LazyVGrid(columns: columns, alignment: .leading, spacing: 20) {
                ForEach(BrainProjectField.allCases) { field in
                    NativeField(label: field.label) {
                        VStack(alignment: .leading, spacing: 5) {
                            NativeTextArea(
                                text: Binding(get: { project[field] }, set: { store.update(.text(field, $0)) }),
                                placeholder: field.placeholder,
                                minHeight: CGFloat(field.rows) * 22
                            )
                            BrainFieldFit(text: project[field], limit: field.readLimit)
                        }
                    }
                }
            }
            VStack(alignment: .leading, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Pillars").font(.nativeLabel)
                    Text("The angles you actually make. Every idea is filed under one.")
                        .font(.system(size: 12)).foregroundStyle(.secondary)
                }
                BrainPillarEditor(pillars: store.pillars) { store.update(.pillars($0)) }
            }
        }
        .nativeCard(padding: 24)
    }
}
