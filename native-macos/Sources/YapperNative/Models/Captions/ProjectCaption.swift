import Foundation

/// One caption card, anchored in recording seconds rather than timeline
/// seconds. Anchoring in the source is what lets trims, restored cuts and
/// reordered clips re-map every card automatically instead of leaving stale
/// captions behind.
struct ProjectCaption: Equatable, Identifiable, Sendable {
    var id: UUID
    var mediaID: UUID
    /// What the card said when it was built, and what it says for good once the
    /// creator has typed into it. Until then the live text comes from the words
    /// still inside the card's source range — see `CaptionWordIndex`.
    var text: String
    /// Set the moment the creator types into this card. From then on the card
    /// stops following the transcript, because the words on it are theirs.
    var isTextEdited: Bool
    var sourceStart: Double
    var sourceEnd: Double
    /// Stable membership for generated fixed-count cards. Source ranges alone
    /// cannot describe a card whose words sit on both sides of an edit cut.
    /// Older and hand-authored cards leave this nil and keep range semantics.
    var wordIDs: [UUID]?

    /// What this card refuses to take from the project caption style. Empty is
    /// the normal case, and it is what keeps an Apply-to-all change visible on
    /// every card the creator has not deliberately restyled.
    var overrides: TextStylePatch

    init(
        id: UUID = UUID(),
        mediaID: UUID,
        text: String,
        isTextEdited: Bool = false,
        sourceStart: Double,
        sourceEnd: Double,
        wordIDs: [UUID]? = nil,
        overrides: TextStylePatch = TextStylePatch()
    ) {
        self.id = id
        self.mediaID = mediaID
        self.text = text
        self.isTextEdited = isTextEdited
        self.sourceStart = sourceStart
        self.sourceEnd = sourceEnd
        self.wordIDs = wordIDs
        self.overrides = overrides
    }

    func resolvedStyle(base: TextStyle) -> TextStyle {
        base.resolving(overrides)
    }

    /// True once the creator has restyled this card away from the shared look.
    var hasStyleOverrides: Bool { !overrides.isEmpty }

    /// Writes the patch as overrides on this one card.
    mutating func override(with patch: TextStylePatch) {
        overrides.merge(patch)
    }

    mutating func clearOverrides(in patch: TextStylePatch) {
        overrides.clearFields(in: patch)
    }
}

// MARK: - Codable

extension ProjectCaption: Codable {
    private enum CodingKeys: String, CodingKey {
        case id, mediaID, text, isTextEdited, sourceStart, sourceEnd, wordIDs, overrides
    }

    /// Cards saved before the appearance model kept their overrides as flat
    /// fields alongside a `background` enum. They are folded into the patch here
    /// so a restyled card opens looking the way it was left.
    private enum LegacyKeys: String, CodingKey {
        case x, y, width, fontScale, font, textCase, background
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        mediaID = try container.decode(UUID.self, forKey: .mediaID)
        text = try container.decode(String.self, forKey: .text)
        // Cards saved before captions followed the transcript were not marked
        // either way, and none of them was hand-edited through this flag — so
        // they all start out listening, which is the behaviour that was wanted.
        isTextEdited = try container.decodeIfPresent(Bool.self, forKey: .isTextEdited) ?? false
        sourceStart = try container.decode(Double.self, forKey: .sourceStart)
        sourceEnd = try container.decode(Double.self, forKey: .sourceEnd)
        wordIDs = try container.decodeIfPresent([UUID].self, forKey: .wordIDs)
        if let stored = try container.decodeIfPresent(TextStylePatch.self, forKey: .overrides) {
            overrides = stored
            return
        }
        let legacy = try decoder.container(keyedBy: LegacyKeys.self)
        var patch = TextStylePatch(
            x: try legacy.decodeIfPresent(Double.self, forKey: .x),
            y: try legacy.decodeIfPresent(Double.self, forKey: .y),
            width: try legacy.decodeIfPresent(Double.self, forKey: .width),
            font: try legacy.decodeIfPresent(TextLayerFont.self, forKey: .font),
            fontScale: try legacy.decodeIfPresent(Double.self, forKey: .fontScale),
            textCase: try legacy.decodeIfPresent(TextCasing.self, forKey: .textCase)
        )
        if let background = try legacy.decodeIfPresent(TextLayerStyle.self, forKey: .background) {
            // The old enum carried colour, card and shadow in one value, so an
            // override of it becomes an override of all three.
            let look = TextAppearance.fromLegacy(style: background, font: .modern, fontScale: 0.024)
            patch.color = look.color
            patch.backgroundEnabled = look.backgroundEnabled
            patch.backgroundColor = look.backgroundColor
            patch.cornerRadius = look.cornerRadius
            patch.shadowEnabled = look.shadowEnabled
        }
        overrides = patch
    }
}
