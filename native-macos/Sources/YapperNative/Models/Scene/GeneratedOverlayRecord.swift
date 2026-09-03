import Foundation

/// What a generated overlay is, beyond the file it is drawn from.
///
/// Lives on the `ProjectMedia` whose `kind` is `.scene`. The library row reads
/// the description and the quote; the revise pass sends the brief and the
/// current scene back to the designer; the renderer resolves brand tokens
/// against `palette`. Versions are immutable files inside the project package,
/// so undo, which is a snapshot of the whole document, restores an earlier
/// design simply by pointing the media back at an earlier file.
struct GeneratedOverlayRecord: Codable, Equatable, Sendable {
    /// One design of this overlay. `fileName` is relative to the asset's own
    /// folder in the package (`generated/<mediaID>/`).
    struct Version: Codable, Equatable, Sendable {
        var number: Int
        var fileName: String
        var posterFileName: String?
        var createdAt: Date
        /// What was asked when this version was made: the original request for
        /// the first, the revision sentence for the rest.
        var instruction: String
        /// What the validator changed or dropped on the way in.
        var notes: [String]

        init(
            number: Int,
            fileName: String,
            posterFileName: String? = nil,
            createdAt: Date = Date(),
            instruction: String,
            notes: [String] = []
        ) {
            self.number = number
            self.fileName = fileName
            self.posterFileName = posterFileName
            self.createdAt = createdAt
            self.instruction = instruction
            self.notes = notes
        }
    }

    /// One sentence about what it looks like, not what it means.
    var description: String
    /// The visual brief the designer worked from.
    var brief: String
    /// The speaker's own words it was made for, verbatim.
    var quote: String
    var cue: String?
    /// The whole sentence the quote sits in, for the revise pass.
    var sentence: String?
    /// `counter`, `chart`, `comparison`, `list`, `diagram`, `typography`,
    /// `map`, `illustration` or `other`.
    var kind: String
    /// Where the quote was found in the recording, so the moment survives
    /// cuts the way captions do. Source seconds in `sourceMediaID`.
    var sourceMediaID: UUID?
    var sourceStart: Double?
    var sourceEnd: Double?
    /// What the brand tokens meant when it was designed.
    var palette: ScenePalette
    var model: String?
    var createdAt: Date
    /// Oldest first. The last entry is the one `ProjectMedia.url` points at.
    var versions: [Version]

    init(
        description: String,
        brief: String,
        quote: String,
        cue: String? = nil,
        sentence: String? = nil,
        kind: String = "other",
        sourceMediaID: UUID? = nil,
        sourceStart: Double? = nil,
        sourceEnd: Double? = nil,
        palette: ScenePalette,
        model: String? = nil,
        createdAt: Date = Date(),
        versions: [Version] = []
    ) {
        self.description = description
        self.brief = brief
        self.quote = quote
        self.cue = cue
        self.sentence = sentence
        self.kind = kind
        self.sourceMediaID = sourceMediaID
        self.sourceStart = sourceStart
        self.sourceEnd = sourceEnd
        self.palette = palette
        self.model = model
        self.createdAt = createdAt
        self.versions = versions
    }

    var currentVersion: Version? { versions.last }
    var nextVersionNumber: Int { (versions.last?.number ?? 0) + 1 }
}
