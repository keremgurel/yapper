import SwiftUI

/// The import sheet: instructions and the file picker, then the collection
/// chooser, then the result.
struct InstagramImportSheet: View {
    @StateObject private var model = InstagramImportModel()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Import your saved inspiration").font(.nativeSectionTitle)
                    Text("Bring your saved posts and collections into Ideas without giving Yapper your Instagram password.")
                        .font(.system(size: 13)).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 12)
                Button { dismiss() } label: { Image(systemName: "xmark").font(.system(size: 12)) }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
                    .keyboardShortcut(.cancelAction)
                    .help("Close")
            }
            .padding(20)
            Rectangle().fill(Color.studioLine).frame(height: 1)

            ScrollView {
                Group {
                    if let result = model.result {
                        InstagramImportResult(imported: result.imported, skipped: result.skipped) { dismiss() }
                    } else if !model.entries.isEmpty {
                        InstagramCollectionList(model: model)
                    } else {
                        InstagramImportSteps(model: model)
                    }
                }
                .padding(20)
            }

            if !model.entries.isEmpty && model.result == nil {
                Rectangle().fill(Color.studioLine).frame(height: 1)
                HStack {
                    if let error = model.error {
                        Text(error).font(.system(size: 12)).foregroundStyle(Color.studioDanger)
                    }
                    Spacer()
                    Button { model.commit() } label: {
                        HStack(spacing: 6) {
                            if model.importing { ProgressView().controlSize(.small) }
                            Text("Import \(model.importable.count) new saves")
                        }
                    }
                    .buttonStyle(EditorPrimaryButtonStyle())
                    .disabled(model.importable.isEmpty || model.importing)
                }
                .padding(16)
            }
        }
        .frame(width: 520, height: 600)
        .background(Color.editorBackground)
    }
}

/// Before a file is picked: how to get the export out of Instagram.
struct InstagramImportSteps: View {
    @ObservedObject var model: InstagramImportModel

    private let steps = [
        "In Instagram, open Accounts Center, then Your information and permissions.",
        "Choose Export your information, select your Instagram profile, then export Saved for All time in JSON format.",
        "When Instagram sends the download, choose the untouched ZIP here.",
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1)").font(.system(size: 11, weight: .semibold))
                        .frame(width: 22, height: 22)
                        .overlay(Circle().strokeBorder(Color.studioLine, lineWidth: 1))
                    Text(step).font(.system(size: 13)).foregroundStyle(.primary.opacity(0.8))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Link(destination: URL(string: "https://www.facebook.com/help/181231772500920")!) {
                Label("Open Meta's export instructions", systemImage: "arrow.up.right").font(.system(size: 12, weight: .medium))
            }
            .clickableCursor()

            VStack(spacing: 10) {
                if model.reading { ProgressView().controlSize(.small) } else {
                    Image(systemName: "square.and.arrow.down").font(.system(size: 20)).foregroundStyle(.secondary)
                }
                Text(model.reading ? "Reading your archive…" : "ZIP, JSON, or HTML, up to 100 MB")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
                Button("Choose Instagram export") { model.choose() }
                    .buttonStyle(EditorSecondaryButtonStyle())
                    .disabled(model.reading)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 28)
            .nativeWell()

            if let error = model.error {
                Text(error).font(.system(size: 13)).foregroundStyle(Color.studioDanger)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Label("The archive is read on this Mac. Yapper imports only the Instagram links you select, not the ZIP or your account credentials.", systemImage: "lock")
                .font(.system(size: 12)).foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// After a file is picked: what was found and which collections come along.
struct InstagramCollectionList: View {
    @ObservedObject var model: InstagramImportModel

    var body: some View {
        let collections = model.collections
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: "doc").foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(model.filename ?? "").font(.system(size: 13, weight: .semibold)).lineLimit(1)
                    Text("\(model.entries.count) unique saves found" + (model.duplicateCount > 0 ? " · \(model.duplicateCount) already in Ideas" : ""))
                        .font(.system(size: 12)).foregroundStyle(.secondary)
                }
                Spacer()
                Button("Change") { model.reset() }.buttonStyle(EditorGhostButtonStyle(size: .small))
            }
            .nativeWell()

            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Choose collections").font(.system(size: 13, weight: .semibold))
                    Text("Collection names are kept on imported references.").font(.system(size: 12)).foregroundStyle(.secondary)
                }
                Spacer()
                Button(model.selected.count == collections.count ? "Clear all" : "Select all") { model.toggleAll() }
                    .buttonStyle(EditorGhostButtonStyle(size: .small))
            }
            .padding(.top, 8)

            ForEach(collections, id: \.name) { collection in
                let checked = model.selected.contains(collection.name)
                Button { model.toggle(collection.name) } label: {
                    HStack(spacing: 10) {
                        IdeaCheckMark(on: checked)
                        Image(systemName: "folder").foregroundStyle(.secondary)
                        Text(collection.name).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                        Spacer()
                        Text(collection.count.newItems == collection.count.total ? "\(collection.count.total)" : "\(collection.count.newItems) new")
                            .font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(checked ? Color.studioSelectedFill : Color.clear))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.studioPlain)
            }
        }
    }
}

/// A read-only check mark, for rows whose whole surface is the button.
struct IdeaCheckMark: View {
    let on: Bool
    var body: some View {
        RoundedRectangle(cornerRadius: 5, style: .continuous)
            .fill(on ? Color.yapperOrange : Color.clear)
            .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).strokeBorder(on ? Color.yapperOrange : Color.studioLineStrong, lineWidth: 1))
            .overlay { if on { Image(systemName: "checkmark").font(.system(size: 10, weight: .semibold)).foregroundStyle(.white) } }
            .frame(width: 16, height: 16)
    }
}

/// Done: how many came in, and the way back to the list.
struct InstagramImportResult: View {
    let imported: Int
    let skipped: Int
    let onDone: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "checkmark").font(.system(size: 20, weight: .semibold))
                .foregroundStyle(NativeChip.Tone.green.color)
                .frame(width: 48, height: 48)
                .background(Circle().fill(NativeChip.Tone.green.color.opacity(0.14)))
            Text("\(imported) saved \(imported == 1 ? "post" : "posts") imported").font(.system(size: 17, weight: .semibold))
            Text("They are in Ideas now as references. Open the ones you want Chirpy to work on.")
                .font(.system(size: 13)).foregroundStyle(.secondary).multilineTextAlignment(.center).frame(maxWidth: 340)
            if skipped > 0 {
                Text("\(skipped) existing \(skipped == 1 ? "item was" : "items were") skipped.").font(.system(size: 12)).foregroundStyle(.secondary)
            }
            Button("View ideas", action: onDone).buttonStyle(EditorSecondaryButtonStyle()).padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }
}
