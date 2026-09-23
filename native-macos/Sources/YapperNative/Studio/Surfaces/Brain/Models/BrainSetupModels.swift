import Foundation

/// The Essentials keys a setup document can fill: the name plus every text field.
enum BrainSetupKey: String, CaseIterable, Identifiable, Sendable {
    case name, whatIMake, audience, voice, scriptingPatterns, offers, doNots
    var id: String { rawValue }

    var field: BrainProjectField? { BrainProjectField(rawValue: rawValue) }
    var label: String { field?.label ?? "What you call this" }

    func current(in project: BrainProject?) -> String {
        guard let project else { return "" }
        return field.map { project[$0] } ?? project.name
    }

    func edit(_ value: String) -> BrainProjectEdit {
        field.map { .text($0, value) } ?? .name(value)
    }
}

struct BrainSetupPillar: Codable, Equatable, Sendable {
    let name: String
    let description: String
    let examples: [String]
}

struct BrainSetupBlock: Codable, Equatable, Sendable {
    let title: String
    let digest: String
    let body: String
    let tags: [String]
    /// "core" or "auto".
    let usage: String
}

/// What one document would write into the Brain. Nothing is saved yet.
struct BrainSetupProposal: Codable, Equatable, Sendable {
    /// Only the keys the document covers.
    var essentials: [String: String]
    let pillars: [BrainSetupPillar]
    let blocks: [BrainSetupBlock]
    let notes: String

    /// The covered keys, in form order.
    var coveredKeys: [BrainSetupKey] {
        BrainSetupKey.allCases.filter { essentials[$0.rawValue] != nil }
    }
}

struct BrainSetupResponse: Codable, Sendable { let proposal: BrainSetupProposal }

/// What the creator chose to keep from a proposal.
struct BrainSetupSelection: Equatable, Sendable {
    enum PillarMode: Sendable { case replace, add }

    var essentials: Set<String>
    var pillarMode: PillarMode
    var pillars: Set<String>
    var blocks: Set<String>

    /// Everything on. A document that lays out a whole pillar system replaces
    /// the list; a single pillar is more likely an addition.
    static func everything(in proposal: BrainSetupProposal, existingPillars: Int) -> BrainSetupSelection {
        BrainSetupSelection(
            essentials: Set(proposal.essentials.keys),
            pillarMode: proposal.pillars.count >= 2 || existingPillars == 0 ? .replace : .add,
            pillars: Set(proposal.pillars.map(\.name)),
            blocks: Set(proposal.blocks.map(\.title))
        )
    }
}

/// Turning a reviewed proposal into the ordinary project patch and block creates.
enum BrainSetupPlan {
    static func projectEdits(
        _ proposal: BrainSetupProposal,
        _ selection: BrainSetupSelection,
        existing: [BrainPillarDraft]
    ) -> [BrainProjectEdit] {
        var edits: [BrainProjectEdit] = BrainSetupKey.allCases.compactMap { key in
            guard selection.essentials.contains(key.rawValue),
                  let value = proposal.essentials[key.rawValue], !value.isEmpty else { return nil }
            return key.edit(value)
        }
        let chosen = proposal.pillars.filter { selection.pillars.contains($0.name) }
        if !chosen.isEmpty {
            edits.append(.pillars(mergePillars(chosen, existing: existing, mode: selection.pillarMode)))
        }
        return edits
    }

    static func mergePillars(
        _ chosen: [BrainSetupPillar],
        existing: [BrainPillarDraft],
        mode: BrainSetupSelection.PillarMode
    ) -> [BrainPillarDraft] {
        var drafts = mode == .replace ? [] : existing
        for pillar in chosen {
            if let index = drafts.firstIndex(where: { $0.name.lowercased() == pillar.name.lowercased() }) {
                if !pillar.description.isEmpty { drafts[index].description = pillar.description }
                if !pillar.examples.isEmpty { drafts[index].examples = pillar.examples }
            } else {
                let kept = existing.first { $0.name.lowercased() == pillar.name.lowercased() }
                drafts.append(BrainPillarDraft(
                    serverID: kept?.serverID, name: pillar.name,
                    description: pillar.description, examples: pillar.examples
                ))
            }
        }
        return drafts
    }

    static func blocks(_ proposal: BrainSetupProposal, _ selection: BrainSetupSelection) -> [NewBrainBlock] {
        proposal.blocks.filter { selection.blocks.contains($0.title) }.map { block in
            NewBrainBlock(
                title: block.title, body: block.body, digest: block.digest,
                usage: BrainBlockUsage(rawValue: block.usage), tags: block.tags
            )
        }
    }
}
