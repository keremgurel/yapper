import Foundation

/// What the creator is about to add from a paste or a file: the local parse,
/// plus a name either they type or the server suggests for one credit.
struct BrainIngestProposal: Codable, Equatable, Sendable {
    var title: String
    var digest: String
    var tags: [String]
    var usage: BrainBlockUsage
    var sourceLabel: String
}

struct BrainIngestResponse: Codable, Sendable { let proposal: BrainIngestProposal }

@MainActor
final class BrainIngestStore: ObservableObject {
    enum Failure: Equatable { case fileTooLarge, fileUnreadable, namingFailed(String) }

    @Published private(set) var detected: BrainDetectedPaste?
    @Published var proposal = BrainIngestProposal(title: "", digest: "", tags: [], usage: .auto, sourceLabel: "")
    @Published private(set) var naming = false
    @Published private(set) var failure: Failure?

    static let importableExtensions = ["csv", "tsv", "txt", "md", "json"]
    static let maxFileBytes = 2 * 1024 * 1024

    func fromText(_ text: String) {
        failure = nil
        let isEmpty = text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        detected = isEmpty ? nil : BrainPasteDetector.detect(text)
        if isEmpty { resetProposal() }
    }

    func fromFile(_ url: URL) {
        failure = nil
        do {
            let text = try Self.readText(url)
            detected = BrainPasteDetector.detect(text)
            resetProposal()
            // The filename is usually the best source label a file import gets.
            proposal.sourceLabel = url.lastPathComponent
        } catch let error as Failure {
            failure = error
        } catch {
            failure = .fileUnreadable
        }
    }

    func nameIt() async {
        guard let detected, !naming else { return }
        naming = true
        failure = nil
        defer { naming = false }
        do {
            let response: BrainIngestResponse = try await StudioJSONClient.post(
                "api/brain/ingest", body: ["sample": detected.sample, "shape": detected.shape]
            )
            let label = proposal.sourceLabel
            proposal = response.proposal
            if !label.isEmpty { proposal.sourceLabel = label }
        } catch {
            failure = .namingFailed(error.localizedDescription)
        }
    }

    /// The draft, as the block create endpoint wants it.
    var newBlock: NewBrainBlock? {
        guard let detected else { return nil }
        return NewBrainBlock(
            title: proposal.title, kind: detected.kind, body: detected.body, items: detected.items,
            rows: detected.rows, digest: proposal.digest, usage: proposal.usage,
            tags: proposal.tags, sourceLabel: proposal.sourceLabel
        )
    }

    func reset() {
        detected = nil
        failure = nil
        resetProposal()
    }

    private func resetProposal() {
        proposal = BrainIngestProposal(title: "", digest: "", tags: [], usage: .auto, sourceLabel: "")
    }

    /// Reads a text file up to the size the web allows.
    static func readText(_ url: URL) throws -> String {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        if size > maxFileBytes { throw Failure.fileTooLarge }
        let data = try Data(contentsOf: url)
        guard let text = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) else {
            throw Failure.fileUnreadable
        }
        return text
    }
}

extension BrainIngestStore.Failure: Error {}
