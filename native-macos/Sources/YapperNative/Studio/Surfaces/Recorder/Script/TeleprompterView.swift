import Foundation

/// What the teleprompter shows while recording. Mirrors the web's
/// `lib/teleprompter/script-view.ts` so both apps prompt the same words.
enum TeleprompterView: String, CaseIterable, Identifiable {
    case script, notes, off
    var id: String { rawValue }

    var label: String {
        switch self {
        case .script: "Full script"
        case .notes: "Hook + key points"
        case .off: "Nothing"
        }
    }

    var detail: String {
        switch self {
        case .script: "Read it word for word"
        case .notes: "Hit the beats, stay natural"
        case .off: "Just the camera. Wing it."
        }
    }
}

/// Where the words come from: a linked content item, or text pasted here.
enum TeleprompterSource: Equatable {
    case item(RecorderContentItem)
    case pasted(String)

    /// The prompt text for a view. Empty for `.off` and whenever there is
    /// nothing to show, so the overlay can hide itself.
    func text(for view: TeleprompterView) -> String {
        switch self {
        case let .pasted(text):
            return view == .off ? "" : text.trimmingCharacters(in: .whitespacesAndNewlines)
        case let .item(item):
            return TeleprompterText.build(item, view: view)
        }
    }

    func has(_ view: TeleprompterView) -> Bool {
        view == .off || !text(for: view).isEmpty
    }

    /// The view a fresh source opens on: the script when there is one, then
    /// the beats, then nothing.
    var defaultView: TeleprompterView {
        if case let .item(item) = self, !(item.script ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return .script
        }
        if case .pasted = self { return has(.script) ? .script : .off }
        return has(.notes) ? .notes : .off
    }
}

enum TeleprompterText {
    static func build(_ item: RecorderContentItem, view: TeleprompterView) -> String {
        switch view {
        case .off:
            return ""
        case .script:
            let script = (item.script ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return script.isEmpty ? notes(item) : script
        case .notes:
            return notes(item)
        }
    }

    /// The opening line, then the beats. Section labels are left out on
    /// purpose: a heading is the one line you must not say out loud. Script
    /// blocks are skipped because they belong to the full script view.
    static func notes(_ item: RecorderContentItem) -> String {
        var lines: [String] = []
        if let hook = item.hooks.map({ $0.text.trimmed }).first(where: { !$0.isEmpty }) {
            lines.append(contentsOf: [hook, ""])
        }
        for block in item.blocks where block.kind != "script" {
            let items = (block.items ?? []).map(\.trimmed).filter { !$0.isEmpty }
            if !items.isEmpty {
                lines.append(contentsOf: items.map { "• \($0)" })
                continue
            }
            let text = (block.text ?? "").trimmed
            if !text.isEmpty { lines.append(contentsOf: [text, ""]) }
        }
        return lines.joined(separator: "\n").trimmed
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
