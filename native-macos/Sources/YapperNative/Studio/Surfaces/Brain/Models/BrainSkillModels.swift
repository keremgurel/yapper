import Foundation

/// The prompts a skill can apply to.
enum BrainSurface: String, Codable, CaseIterable, Identifiable, Sendable {
    case ideate, hooks, script, caption, expand, chat, capture
    var id: String { rawValue }

    /// The skill editor's name for it.
    var label: String {
        switch self {
        case .ideate: "Ideas"
        case .hooks: "Hooks"
        case .script: "Scripts"
        case .caption: "Captions"
        case .expand: "References"
        case .chat: "The coach"
        case .capture: "Quick capture"
        }
    }

    /// The preview picker's name for it.
    var previewLabel: String {
        switch self {
        case .script: "Writing a script"
        case .hooks: "Writing hooks"
        case .ideate: "Coming up with ideas"
        case .expand: "Working up a reference"
        case .caption: "Writing a caption"
        case .chat: "Talking to the coach"
        case .capture: "Filing a quick idea"
        }
    }

    /// The order the preview picker lists them in.
    static let previewOrder: [BrainSurface] = [.script, .hooks, .ideate, .expand, .caption, .chat, .capture]
}

/// One skill the creator has installed or written.
struct BrainSkill: Codable, Equatable, Identifiable, Sendable {
    let id: String
    var catalogSlug: String?
    var catalogVersion: Int?
    var name: String
    var whenToUse: String
    var instructions: String
    /// Raw strings, so a surface added on the server never fails the decode.
    var surfaces: [String]
    /// Version formats it is limited to; nil or empty means every format.
    var formats: [String]?
    var enabled: Bool
    var customized: Bool
    var sortOrder: Int

    static let starterSlugs: Set<String> = [
        "write-like-a-person", "hook-shapes", "storytime-three-acts", "show-dont-say", "caption-that-earns-the-save",
        "chapters-that-hold", "skimmable-sections",
    ]

    var isStarter: Bool { catalogSlug.map(Self.starterSlugs.contains) ?? false }

    /// Read on every piece of writing instead of being picked per piece.
    /// Mirrors `ALWAYS_ON_SKILL_SLUGS` in src/lib/brain/context/always-on.ts.
    var isAlwaysOn: Bool { catalogSlug == "write-like-a-person" }

    /// The formats it is limited to, in tab order; empty means all of them.
    var versionFormats: [IdeaCanvasVersionFormat] {
        IdeaCanvasVersionFormat.allCases.filter { (formats ?? []).contains($0.rawValue) }
    }

    /// Whether it shapes this format's writing.
    func applies(to format: IdeaCanvasVersionFormat) -> Bool {
        versionFormats.isEmpty || versionFormats.contains(format)
    }
}

struct BrainSkillsResponse: Codable, Sendable { let skills: [BrainSkill] }
struct BrainSkillResponse: Codable, Sendable { let skill: BrainSkill }

/// One change to a skill.
enum BrainSkillEdit: Equatable, Sendable {
    case name(String)
    case whenToUse(String)
    case instructions(String)
    case surfaces([String])
    case formats([String])
    case enabled(Bool)

    var patch: BrainPatch {
        switch self {
        case .name(let value): ["name": .string(value)]
        case .whenToUse(let value): ["whenToUse": .string(value)]
        case .instructions(let value): ["instructions": .string(value)]
        case .surfaces(let value): ["surfaces": .strings(value)]
        case .formats(let value): ["formats": .strings(value)]
        case .enabled(let value): ["enabled": .bool(value)]
        }
    }

    func apply(to skill: inout BrainSkill) {
        switch self {
        case .name(let value): skill.name = value
        case .whenToUse(let value): skill.whenToUse = value
        case .instructions(let value): skill.instructions = value
        case .surfaces(let value): skill.surfaces = value
        case .formats(let value): skill.formats = value
        case .enabled(let value): skill.enabled = value
        }
    }
}

/// One entry on the catalog shelf, with what this creator already has of it.
struct BrainCatalogEntry: Codable, Equatable, Identifiable, Sendable {
    let slug: String
    let version: Int
    let kind: String
    let name: String
    let tagline: String
    let whenToUse: String
    let instructions: String
    let surfaces: [String]
    let category: String
    let installedVersion: Int?
    let customized: Bool

    var id: String { slug }
    var isContext: Bool { kind == "context" }
    var installed: Bool { installedVersion != nil }
    var updateAvailable: Bool { installedVersion.map { $0 < version } ?? false }
    /// Installed, edited, and current: the button restores the official copy.
    var resettable: Bool { installed && customized && !updateAvailable }
}

struct BrainCatalogResponse: Codable, Sendable { let entries: [BrainCatalogEntry] }

/// Installing returns a skill for a skill entry, a block for a context entry.
struct BrainInstallResponse: Codable, Sendable {
    let skill: BrainSkill?
    let block: BrainBlock?
}
