import Foundation

/// One document in, a reviewed Brain out. Reading costs a credit, so it waits
/// for a click; applying is the ordinary project patch and block creates.
@MainActor
final class BrainSetupStore: ObservableObject {
    enum Failure: Equatable { case file(String), extract(String), apply }

    @Published var document = ""
    @Published private(set) var proposal: BrainSetupProposal?
    @Published var selection: BrainSetupSelection?
    @Published private(set) var extracting = false
    @Published private(set) var applying = false
    @Published private(set) var failure: Failure?

    var canExtract: Bool {
        document.trimmingCharacters(in: .whitespacesAndNewlines).count >= 40 && !extracting
    }

    func loadFile(_ url: URL) {
        failure = nil
        do {
            document = try BrainIngestStore.readText(url)
        } catch BrainIngestStore.Failure.fileTooLarge {
            failure = .file("That file is too large to read here. Paste the part you need instead.")
        } catch {
            failure = .file("That file couldn't be read. Paste its text instead.")
        }
    }

    func extract(existingPillars: Int) async {
        guard canExtract else { return }
        extracting = true
        failure = nil
        defer { extracting = false }
        do {
            let response: BrainSetupResponse = try await BrainLongRequest.post(
                "api/brain/setup", body: ["document": document], timeout: 120
            )
            proposal = response.proposal
            selection = .everything(in: response.proposal, existingPillars: existingPillars)
        } catch let error as StudioAPIError where error.status == 402 || error.status == 429 {
            failure = .extract(error.message)
        } catch {
            failure = .extract("Couldn't read that document. Nothing was charged; try again.")
        }
    }

    func editEssential(_ key: BrainSetupKey, _ value: String) {
        proposal?.essentials[key.rawValue] = value
    }

    /// Writes what was kept. Returns true when all of it landed.
    func apply(project: BrainProjectStore, blocks: BrainBlocksStore) async -> Bool {
        guard let proposal, let selection, !applying else { return false }
        applying = true
        failure = nil
        defer { applying = false }
        do {
            let edits = BrainSetupPlan.projectEdits(proposal, selection, existing: project.pillars)
            if !edits.isEmpty { try await project.updateAndSave(edits) }
            for block in BrainSetupPlan.blocks(proposal, selection) { try await blocks.add(block) }
            return true
        } catch {
            failure = .apply
            return false
        }
    }

    func startOver() {
        proposal = nil
        selection = nil
        failure = nil
    }

    func reset() {
        document = ""
        startOver()
    }
}
