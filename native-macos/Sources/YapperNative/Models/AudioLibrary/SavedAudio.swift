import Foundation

/// What a saved file is for.
///
/// The only thing a creator has to decide when importing, and the only way the
/// library is shelved. Three kinds is deliberately fewer than the sound effect
/// catalogue's five: a personal library is small, and the question worth
/// answering is "is this a bed, a hit, or a voice", not which shelf a whoosh
/// belongs on.
enum SavedAudioKind: String, Codable, CaseIterable, Identifiable, Sendable {
    /// Beds and tracks that run under an edit.
    case music
    /// Hits, stings and transitions of the creator's own.
    case effect
    /// Recorded voice: intros, outros, drops, a line to reuse.
    case voice

    var id: String { rawValue }

    var title: String {
        switch self {
        case .music: "Music"
        case .effect: "Sound effects"
        case .voice: "Voice"
        }
    }

    /// The singular, for one item's badge.
    var itemTitle: String {
        switch self {
        case .music: "Music"
        case .effect: "Effect"
        case .voice: "Voice"
        }
    }

    var icon: String {
        switch self {
        case .music: "music.note"
        case .effect: "waveform"
        case .voice: "mic"
        }
    }

    /// What a shelf says when it is empty, so the page still explains itself
    /// before anything has been imported.
    var hint: String {
        switch self {
        case .music: "Beds and tracks to run under an edit."
        case .effect: "Your own hits, stings and transitions."
        case .voice: "Intros, outros, drops, any line worth reusing."
        }
    }

    /// Long files are the rule for music and the exception everywhere else,
    /// which is the one thing the importer can guess correctly.
    static func guessed(fromDuration duration: Double) -> SavedAudioKind {
        duration >= 20 ? .music : .effect
    }
}

/// One file in the creator's audio library.
///
/// The file itself is copied into the library folder on import, so a saved
/// sound survives the Downloads folder being emptied and the SD card coming
/// out. `fileName` is the copy's name, not the original's.
struct SavedAudio: Identifiable, Codable, Equatable, Sendable {
    let id: UUID
    var name: String
    var kind: SavedAudioKind
    /// Inside the library folder. Never a path: the folder moves between
    /// machines and OS versions, the name does not.
    let fileName: String
    let duration: Double
    /// Of the file's bytes, so importing the same sound twice adds it once.
    let contentHash: String
    let addedAt: Date

    init(
        id: UUID = UUID(),
        name: String,
        kind: SavedAudioKind,
        fileName: String,
        duration: Double,
        contentHash: String,
        addedAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.kind = kind
        self.fileName = fileName
        self.duration = duration
        self.contentHash = contentHash
        self.addedAt = addedAt
    }
}
