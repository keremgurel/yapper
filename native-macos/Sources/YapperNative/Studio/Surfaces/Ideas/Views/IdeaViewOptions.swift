import SwiftUI

/// "View options": the button, and the popover that edits the active view.
struct IdeaViewOptionsButton: View {
    let view: LibraryView
    @StateObject private var model: ViewOptionsDraft
    @State private var open = false

    init(view: LibraryView) {
        self.view = view
        _model = StateObject(wrappedValue: ViewOptionsDraft(view: view))
    }

    var body: some View {
        Button { open.toggle() } label: {
            Label(model.state == .failed ? "View options · Unsaved" : "View options", systemImage: "slider.horizontal.3")
                .font(.system(size: 12, weight: .medium))
        }
        .buttonStyle(EditorGhostButtonStyle(size: .small))
        .popover(isPresented: $open, arrowEdge: .bottom) {
            IdeaViewOptionsForm(model: model)
        }
        .onChange(of: open) { _, isOpen in
            if !isOpen { Task { await model.flush() } }
        }
    }
}

/// Everything that makes one view different from another.
struct IdeaViewOptionsForm: View {
    @ObservedObject var model: ViewOptionsDraft
    @State private var confirmDelete = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                statusLine
                NativeField(label: "Name") {
                    TextField("View name", text: Binding(
                        get: { model.draft.name },
                        set: { value in model.edit { $0.name = String(value.prefix(60)) } }
                    ))
                    .textFieldStyle(.native)
                }
                NativeField(label: "Layout") {
                    HStack(spacing: 6) {
                        ForEach(ViewLayout.allCases, id: \.self) { layout in
                            toggle(layout.label, on: model.draft.kind == layout.rawValue) { model.edit { $0.kind = layout.rawValue } }
                        }
                    }
                }
                NativeField(label: "Group by") {
                    HStack(spacing: 6) {
                        toggle("None", on: model.draft.groupBy == nil) { model.edit { $0.groupBy = nil } }
                        ForEach(ViewGrouping.allCases, id: \.self) { grouping in
                            toggle(grouping.label, on: model.draft.groupBy == grouping.rawValue) { model.edit { $0.groupBy = grouping.rawValue } }
                        }
                    }
                }
                NativeField(label: "Only show status") {
                    IdeaChipFlow(spacing: 6) {
                        ForEach(IdeaStatus.allCases) { status in
                            filterChip(status.label, key: "status", value: status.rawValue)
                        }
                    }
                }
                NativeField(label: "Only show format") {
                    IdeaChipFlow(spacing: 6) {
                        ForEach(IdeaFormat.all) { format in
                            filterChip(format.label, key: "formats", value: format.id)
                        }
                    }
                }
                if model.draft.kind == ViewLayout.table.rawValue {
                    NativeField(label: "Columns") { IdeaColumnPicker(model: model) }
                }
                Rectangle().fill(Color.studioLine).frame(height: 1)
                deleteRow
            }
            .padding(16)
        }
        .frame(width: 320)
        .frame(maxHeight: 520)
        .disabled(model.deleting)
    }

    @ViewBuilder
    private var statusLine: some View {
        if model.state == .failed {
            HStack(spacing: 8) {
                Text("Your view changes couldn't be saved. Your edits are kept here.")
                    .font(.system(size: 12)).foregroundStyle(Color.studioDanger)
                Button("Retry") { Task { await model.flush() } }.buttonStyle(EditorGhostButtonStyle(size: .mini))
            }
        } else if model.state == .saving {
            Text("Saving view…").font(.system(size: 12)).foregroundStyle(.secondary)
        }
        if model.deleteFailed {
            Text("This view couldn't be deleted. Try again.").font(.system(size: 12)).foregroundStyle(Color.studioDanger)
        }
    }

    private var deleteRow: some View {
        HStack(spacing: 8) {
            if confirmDelete {
                Button("Delete view") { Task { await model.delete() } }
                    .buttonStyle(EditorDestructiveButtonStyle(size: .small))
                Button("Keep it") { confirmDelete = false }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
            } else {
                Button { confirmDelete = true } label: { Label("Delete this view", systemImage: "trash") }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
            }
        }
    }

    private func toggle(_ label: String, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(on ? Color.primary : Color.secondary)
                .padding(.horizontal, 10)
                .frame(height: 26)
                .background(RoundedRectangle(cornerRadius: 7, style: .continuous).fill(on ? Color.studioSelectedFill : Color.studioFaintFill))
                .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).strokeBorder(on ? Color.yapperOrange.opacity(0.6) : Color.clear, lineWidth: 1))
        }
        .buttonStyle(.studioPlain)
    }

    private func filterChip(_ label: String, key: String, value: String) -> some View {
        toggle(label, on: (model.draft.filters[key] ?? []).contains(value)) { model.toggleFilter(key, value) }
    }
}

/// Per-view column visibility, one row per column. Title is always shown.
struct IdeaColumnPicker: View {
    @ObservedObject var model: ViewOptionsDraft

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(IdeaColumn.allCases.filter { $0 != .title }) { column in
                let on = model.visibleColumns.contains(column)
                Button { model.toggleColumn(column) } label: {
                    HStack {
                        Text(column.pickerLabel).font(.system(size: 13)).foregroundStyle(on ? Color.primary : Color.secondary)
                        Spacer()
                        Image(systemName: on ? "eye" : "eye.slash").font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 6).padding(.vertical, 5)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.studioPlain)
            }
            Text("Title is always shown.").font(.system(size: 11)).foregroundStyle(.secondary).padding(.horizontal, 6).padding(.top, 4)
        }
    }
}
