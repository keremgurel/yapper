import Foundation

/// A block as Chirpy hands it back.
struct IdeaCanvasBlockInput: Equatable {
    var label: String
    var kind: IdeaCanvasBlockKind
    var text: String?
    var items: [String]?
}

/// One change Chirpy asks for, against numbered blocks. Ported from
/// `lib/content/canvas-actions.ts`: a reply can only add, replace or rewrite
/// whole blocks, never scribble across the creator's other words.
enum IdeaCanvasAction: Equatable {
    case replace(index: Int, block: IdeaCanvasBlockInput)
    case insert(after: Int?, block: IdeaCanvasBlockInput)
    case append(block: IdeaCanvasBlockInput)
    case hooks(options: [String], replace: Bool)
    case title(String)
}

/// The parts of the piece a reply can change.
struct IdeaCanvasState: Equatable {
    var title: String
    var blocks: [IdeaCanvasBlock]
    var hooks: [String]
}

enum IdeaCanvasActions {
    static let maxActions = 12
    static let maxLabel = 60
    /// Matches the server's CANVAS_LIMITS.maxText: room for a long-form script.
    static let maxText = 20_000
    static let maxItems = 30
    static let maxItem = 400
    static let maxHooks = 8
    static let maxHook = 200
    static let maxTitle = 120

    /// Applies actions in order. Indexes point at the document as it was when
    /// the ask was made. Replace keeps the block's identity, and keeps its
    /// label when the reply left the label blank.
    static func apply(_ state: IdeaCanvasState, _ actions: [IdeaCanvasAction]) -> IdeaCanvasState {
        var next = state
        let snapshot = state.blocks
        for action in actions {
            switch action {
            case .replace(let index, let input):
                guard snapshot.indices.contains(index) else { break }
                let targetID = snapshot[index].id
                next.blocks = IdeaCanvasDoc.update(next.blocks, id: targetID) { block in
                    block.label = input.label.isEmpty ? block.label : input.label
                    block.kind = input.kind
                    block.text = input.text ?? ""
                    block.items = input.items ?? []
                }
            case .insert(let after, let input):
                let anchor = after.flatMap { snapshot.indices.contains($0) ? snapshot[$0].id : nil }
                next.blocks = IdeaCanvasDoc.insert(IdeaCanvasBlock(input: input), after: anchor, in: next.blocks)
            case .append(let input):
                next.blocks.append(IdeaCanvasBlock(input: input))
            case .hooks(let options, let replace):
                next.hooks = replace ? options : next.hooks + options
            case .title(let title):
                next.title = title
            }
        }
        return next
    }

    /// One line saying what a reply did.
    static func describe(_ actions: [IdeaCanvasAction]) -> String {
        guard !actions.isEmpty else { return "No changes." }
        let parts = actions.map { action -> String in
            switch action {
            case .replace(let index, let block):
                return "Rewrote \(block.label.isEmpty ? "block \(index + 1)" : block.label)"
            case .insert(_, let block), .append(let block):
                return "Added \(block.label.isEmpty ? "a block" : block.label)"
            case .hooks(let options, let replace):
                if replace { return "Replaced the hooks with \(options.count) new ones" }
                return "Added \(options.count) hook\(options.count == 1 ? "" : "s")"
            case .title(let title):
                return "Renamed the piece to \"\(title)\""
            }
        }
        return parts.joined(separator: ". ") + "."
    }

    /// Bounded blocks for the request body.
    static func blocksForRequest(_ blocks: [IdeaCanvasBlock]) -> [IdeaCanvasStoredBlock] {
        blocks.prefix(20).map { block in
            let label = String(block.label.prefix(maxLabel))
            if block.kind.isList {
                return IdeaCanvasStoredBlock(
                    label: label, kind: block.kind.rawValue,
                    items: block.items.prefix(maxItems).map { String($0.prefix(maxItem)) }
                )
            }
            return IdeaCanvasStoredBlock(label: label, kind: block.kind.rawValue, text: String(block.text.prefix(maxText)))
        }
    }
}
