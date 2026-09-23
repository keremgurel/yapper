import SwiftUI

/// Where the prompt comes from: an idea, pasted text, or nothing, and which
/// part of it the teleprompter shows.
struct RecorderScriptPanel: View {
    @ObservedObject var script: RecorderScriptStore
    @State private var picking = false
    @State private var pasting = false
    @State private var draft = ""

    var body: some View {
        NativeSection(title: "Script", card: true) {
            VStack(alignment: .leading, spacing: 14) {
                source
                if pasting { pasteEditor }
                if script.source != nil {
                    RecorderViewChoices(script: script)
                    preview
                }
            }
        }
        .sheet(isPresented: $picking) {
            RecorderIdeaPicker { id in
                picking = false
                pasting = false
                Task { await script.load(itemID: id) }
            } onCancel: { picking = false }
        }
    }

    @ViewBuilder
    private var source: some View {
        switch script.loadState {
        case .loading:
            NativeLoadingState(label: "Loading the script…")
        case let .failed(_, message, missing):
            VStack(alignment: .leading, spacing: 10) {
                NativeErrorState(message: message, retry: missing ? nil : { Task { await script.retry() } })
                chooseButtons
            }
        case .idle:
            if let title = sourceTitle {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title).font(.system(size: 14, weight: .semibold)).lineLimit(2)
                        Text(script.itemID == nil ? "Pasted here. Saving makes a new library item." : "Saving links the take to this idea.")
                            .font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 8)
                    Button("Change") { picking = true }.buttonStyle(EditorSecondaryButtonStyle(size: .small))
                    Button("Clear") { pasting = false; script.clear() }.buttonStyle(EditorGhostButtonStyle(size: .small))
                }
            } else if !pasting {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Record straight to camera, or put your script on screen.")
                        .font(.system(size: 13)).foregroundStyle(.secondary)
                    chooseButtons
                }
            }
        }
    }

    private var chooseButtons: some View {
        HStack(spacing: 8) {
            Button("Pick an idea") { picking = true }.buttonStyle(EditorSecondaryButtonStyle(size: .small))
            Button("Paste a script") { draft = ""; pasting = true }.buttonStyle(EditorGhostButtonStyle(size: .small))
        }
    }

    private var pasteEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            NativeTextArea(text: $draft, placeholder: "Paste or type what you want to say", minHeight: 120)
            HStack(spacing: 8) {
                Button("Use this script") {
                    script.usePasted(draft)
                    pasting = false
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button("Cancel") { pasting = false }.buttonStyle(EditorGhostButtonStyle(size: .small))
            }
        }
    }

    private var preview: some View {
        DisclosureGroup {
            ScrollView {
                Text(script.promptText.isEmpty ? "The teleprompter is off for this take." : script.promptText)
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .lineSpacing(3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
            .frame(maxHeight: 220)
            .nativeWell(padding: 12)
            .padding(.top, 8)
        } label: {
            Text("Preview your prompt").font(.system(size: 13, weight: .medium))
        }
    }

    private var sourceTitle: String? {
        switch script.source {
        case let .item(item): item.title.isEmpty ? "Untitled idea" : item.title
        case .pasted: "Pasted script"
        case nil: nil
        }
    }
}

/// Full script, hook and key points, or nothing. Choices with nothing
/// written for this idea are shown but can't be picked.
private struct RecorderViewChoices: View {
    @ObservedObject var script: RecorderScriptStore

    var body: some View {
        VStack(spacing: 6) {
            ForEach(TeleprompterView.allCases) { view in
                let enabled = script.isAvailable(view)
                let selected = script.view == view
                Button { script.view = view } label: {
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(view.label).font(.system(size: 13, weight: .semibold))
                            Text(enabled ? view.detail : "Nothing written for this yet")
                                .font(.system(size: 12)).foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 0)
                        if selected { Image(systemName: "checkmark").foregroundStyle(Color.yapperOrange) }
                    }
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(selected ? Color.studioSelectedFill : Color.studioInputBackground)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.studioPlain)
                .disabled(!enabled)
                .opacity(enabled ? 1 : 0.45)
                .clickableCursor(enabled: enabled)
            }
        }
    }
}
