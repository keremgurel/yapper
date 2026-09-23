import SwiftUI

/// The multi-select bar, floating at the bottom while anything is selected:
/// move to a pillar, set a status, delete, or clear.
struct IdeaBulkBar: View {
    @ObservedObject var selection: IdeaSelection = .shared
    @ObservedObject var pillars: IdeaPillarsStore = .shared
    @State private var confirmDelete = false

    var body: some View {
        VStack(spacing: 8) {
            if selection.failed {
                Text("The change couldn't be confirmed. Your selection is kept; check the items and try again.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.studioDanger)
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(NativeCardBackground(radius: 10))
            }
            HStack(spacing: 6) {
                Text("\(selection.count) selected").font(.system(size: 13, weight: .semibold)).padding(.horizontal, 6)
                pillarMenu
                statusMenu
                deleteControl
                Button { selection.clear() } label: { Image(systemName: "xmark").font(.system(size: 12)) }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
                    .help("Clear selection")
            }
            .disabled(selection.busy)
            .padding(.horizontal, 10).padding(.vertical, 8)
            .background(NativeCardBackground(radius: 12))
        }
        .padding(.bottom, 24)
    }

    private var pillarMenu: some View {
        Menu {
            Section("Move to pillar") {
                if pillars.pillars.isEmpty {
                    Text("No pillars yet. Add them in Brain.")
                }
                ForEach(pillars.pillars) { pillar in
                    Button(pillar.name) { selection.run(.pillar(pillar.id)) }
                }
            }
            Divider()
            Button("Clear pillar") { selection.run(.pillar(nil)) }
        } label: {
            Label("Pillar", systemImage: "tag").font(.system(size: 13, weight: .medium))
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .padding(.horizontal, 8)
        .clickableCursor()
    }

    private var statusMenu: some View {
        Menu {
            ForEach(IdeaStatus.allCases) { status in
                Button(status.label) { selection.run(.status(status)) }
            }
        } label: {
            Text("Status").font(.system(size: 13, weight: .medium))
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .padding(.horizontal, 8)
        .clickableCursor()
    }

    @ViewBuilder
    private var deleteControl: some View {
        if confirmDelete {
            Button("Delete \(selection.count)") {
                confirmDelete = false
                selection.run(.delete)
            }
            .buttonStyle(EditorDestructiveButtonStyle(size: .small))
            Button("Cancel") { confirmDelete = false }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
        } else {
            Button { confirmDelete = true } label: { Image(systemName: "trash").font(.system(size: 12)) }
                .buttonStyle(EditorGhostButtonStyle(size: .small))
                .help("Delete selected")
        }
    }
}
