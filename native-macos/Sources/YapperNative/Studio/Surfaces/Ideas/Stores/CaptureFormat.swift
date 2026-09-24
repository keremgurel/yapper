import Foundation

/// Which format the next captured idea starts in. It follows the default
/// format set in Brain until the creator picks another one in the composer,
/// and goes back to the default once that idea is sent.
@MainActor
final class CaptureFormat: ObservableObject {
    static let shared = CaptureFormat()

    @Published private(set) var defaultFormat: IdeaCanvasVersionFormat = .short
    /// A choice made for this one draft; nil means the default.
    @Published var chosen: IdeaCanvasVersionFormat?

    var current: IdeaCanvasVersionFormat { chosen ?? defaultFormat }

    private struct ProjectEnvelope: Decodable {
        struct Project: Decodable { let defaultFormat: IdeaCanvasVersionFormat? }
        let project: Project
    }

    func refresh() async {
        if let envelope: ProjectEnvelope = try? await StudioJSONClient.get("api/project"),
           let format = envelope.project.defaultFormat {
            defaultFormat = format
        }
    }

    /// Brain changed the default; the composer shows it straight away.
    func setDefault(_ format: IdeaCanvasVersionFormat) { defaultFormat = format }

    func reset() { chosen = nil }
}
