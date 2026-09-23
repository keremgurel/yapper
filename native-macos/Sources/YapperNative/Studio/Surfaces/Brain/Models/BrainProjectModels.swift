import Foundation

/// The Essentials: who the creator is, in their own words.
struct BrainProject: Codable, Equatable, Sendable {
    let id: String
    var name: String
    var whatIMake: String
    var audience: String
    var voice: String
    var scriptingPatterns: String
    var offers: String
    var doNots: String

    subscript(field: BrainProjectField) -> String {
        get {
            switch field {
            case .whatIMake: whatIMake
            case .audience: audience
            case .voice: voice
            case .scriptingPatterns: scriptingPatterns
            case .offers: offers
            case .doNots: doNots
            }
        }
        set {
            switch field {
            case .whatIMake: whatIMake = newValue
            case .audience: audience = newValue
            case .voice: voice = newValue
            case .scriptingPatterns: scriptingPatterns = newValue
            case .offers: offers = newValue
            case .doNots: doNots = newValue
            }
        }
    }
}

/// A pillar as the server stores it.
struct BrainPillar: Codable, Equatable, Sendable {
    let id: String
    let name: String
    let description: String
    let examples: [String]
    let sortOrder: Int
}

/// `GET` and `PATCH /api/project`.
struct BrainProjectPayload: Codable, Equatable, Sendable {
    let project: BrainProject
    let pillars: [BrainPillar]
}

/// A pillar being edited. New rows have no server id until the next save;
/// `localID` keeps a row's identity steady on screen across that save.
struct BrainPillarDraft: Equatable, Identifiable, Sendable {
    var localID = UUID()
    var serverID: String?
    var name: String
    var description: String
    var examples: [String]

    var id: UUID { localID }

    init(serverID: String? = nil, name: String = "", description: String = "", examples: [String] = []) {
        self.serverID = serverID
        self.name = name
        self.description = description
        self.examples = examples
    }

    init(_ pillar: BrainPillar) {
        self.init(serverID: pillar.id, name: pillar.name, description: pillar.description, examples: pillar.examples)
    }

    var json: BrainJSONValue {
        var object: BrainPatch = [
            "name": .string(name),
            "description": .string(description),
            "examples": .strings(examples),
        ]
        if let serverID { object["id"] = .string(serverID) }
        return .object(object)
    }

    /// Same content, ignoring on-screen identity.
    func sameContent(as other: BrainPillarDraft) -> Bool {
        serverID == other.serverID && name == other.name
            && description == other.description && examples == other.examples
    }
}

/// The free-text Essentials fields, in the order the form shows them.
enum BrainProjectField: String, CaseIterable, Identifiable, Sendable {
    case whatIMake, audience, voice, scriptingPatterns, offers, doNots
    var id: String { rawValue }

    var label: String {
        switch self {
        case .whatIMake: "What I make"
        case .audience: "Who it's for"
        case .voice: "How I sound"
        case .scriptingPatterns: "How my scripts are built"
        case .offers: "What I'm promoting"
        case .doNots: "Never say"
        }
    }

    var placeholder: String {
        switch self {
        case .whatIMake: "Short-form video helping people pass the CELPIP speaking exam."
        case .audience: "Newcomers to Canada, 20-40, already studying, anxious about speaking."
        case .voice: "Direct and warm. Second person. Fast cold opens. No filler."
        case .scriptingPatterns: "Open on the mistake, not the topic. One idea per video. Close with the next step, never a recap."
        case .offers: "The practice app (free tier) and the referral program."
        case .doNots: "No guaranteed-score claims. No 'unlock your potential'. Never mock the test-taker."
        }
    }

    /// Rough height in lines, from the web form.
    var rows: Int { self == .offers || self == .doNots ? 2 : 3 }
}

/// One change to the Essentials.
enum BrainProjectEdit: Equatable, Sendable {
    case name(String)
    case text(BrainProjectField, String)
    case pillars([BrainPillarDraft])

    var patch: BrainPatch {
        switch self {
        case .name(let value): ["name": .string(value)]
        case .text(let field, let value): [field.rawValue: .string(value)]
        case .pillars(let value): ["pillars": .array(value.map(\.json))]
        }
    }
}
