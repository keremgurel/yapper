import Foundation

/// A handoff carries an item identity, never an arbitrary download URL.
struct StudioEditorRequest: Identifiable, Equatable {
    let id = UUID()
    let itemID: UUID?

    init(itemID: UUID? = nil) { self.itemID = itemID }

    init?(url: URL) {
        guard url.scheme?.lowercased() == "yapper-studio",
              url.host == "open", url.path == "/editor",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else { return nil }
        let items = (components.queryItems ?? []).filter { $0.name == "item" }
        guard items.count <= 1 else { return nil }
        if let raw = items.first?.value {
            guard let parsed = UUID(uuidString: raw) else { return nil }
            itemID = parsed
        } else if items.isEmpty {
            itemID = nil
        } else { return nil }
    }
}

struct StudioContentSource: Codable, Hashable, Sendable {
    let userID: String
    let itemID: UUID
    let submissionID: UUID
}
