import SwiftUI

/// The shelf, grouped by category, because a creator browsing it is asking
/// "what could improve my scripts", and the categories answer that.
struct BrainCatalogSheet: View {
    let onClose: () -> Void
    @ObservedObject private var store = BrainCatalogStore.shared

    var body: some View {
        BrainSheetFrame(
            title: "Skills",
            description: "Ways of writing you can hand to the AI. Adding one takes a copy you own and can rewrite.",
            onClose: onClose
        ) {
            if store.failed {
                BrainInlineError(message: "Something went wrong. Close this and open it again.")
            }
            if store.loading {
                NativeLoadingState(label: "Loading the shelf…")
            } else if store.groups.isEmpty, !store.failed {
                Text("Nothing on the shelf yet.").font(.system(size: 13)).foregroundStyle(.secondary)
            }
            ForEach(store.groups, id: \.category) { group in
                VStack(alignment: .leading, spacing: 8) {
                    Text(group.category).font(.system(size: 13, weight: .semibold))
                    ForEach(group.entries) { entry in
                        BrainCatalogCard(entry: entry, installing: store.installing == entry.slug) {
                            Task { await store.install(entry) }
                        }
                    }
                }
            }
        }
        .task { await store.load() }
    }
}

/// One entry: not installed, installed and current, or installed and
/// behind. Taking an update over edited text asks first.
struct BrainCatalogCard: View {
    let entry: BrainCatalogEntry
    let installing: Bool
    let onInstall: () -> Void

    @State private var confirming = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.name).font(.system(size: 13, weight: .semibold))
                    Text(entry.tagline).font(.system(size: 12)).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
                action
            }
            BrainFlowLayout(spacing: 4) {
                if entry.isContext {
                    NativeChip(text: "Starting point", tone: .violet)
                } else {
                    ForEach(entry.surfaces, id: \.self) { NativeChip(text: $0) }
                }
                if entry.updateAvailable && entry.customized {
                    Text("Updating replaces your edits").font(.system(size: 12)).foregroundStyle(NativeChip.Tone.yellow.color)
                }
                if entry.resettable {
                    Text("Reset restores Yapper's version").font(.system(size: 12)).foregroundStyle(.secondary)
                }
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color.studioLine))
        .confirmationDialog(
            "\(entry.updateAvailable ? "Update" : "Reset") \u{201C}\(entry.name)\u{201D} to Yapper's current version?",
            isPresented: $confirming
        ) {
            Button(entry.updateAvailable ? "Update" : "Reset", role: .destructive, action: onInstall)
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your edits to this skill will be replaced.")
        }
    }

    @ViewBuilder
    private var action: some View {
        if entry.installed && !entry.updateAvailable && !entry.resettable {
            Label("Added", systemImage: "checkmark").font(.system(size: 12)).foregroundStyle(.secondary)
        } else {
            Button {
                if entry.customized { confirming = true } else { onInstall() }
            } label: {
                HStack(spacing: 5) {
                    if installing {
                        ProgressView().controlSize(.mini)
                    } else {
                        Image(systemName: entry.updateAvailable || entry.resettable ? "arrow.clockwise" : "arrow.down.to.line")
                    }
                    Text(entry.updateAvailable ? "Update" : entry.resettable ? "Reset" : "Add")
                }
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(installing)
        }
    }
}
