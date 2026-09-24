import SwiftUI

/// What the Brain page has open in its editor panel, if anything.
enum BrainEditing: Identifiable, Hashable {
    case skill(String)
    case block(String)

    var id: String {
        switch self {
        case .skill(let id): "skill-\(id)"
        case .block(let id): "block-\(id)"
        }
    }
}

/// Opens a skill or a section in the editor panel from anywhere on the page.
@MainActor
final class BrainEditorRouter: ObservableObject {
    static let shared = BrainEditorRouter()
    @Published var editing: BrainEditing?
}
