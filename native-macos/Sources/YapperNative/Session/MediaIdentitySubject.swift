import Foundation

/// One file the edit needs, with the identity the project expects it to hold.
///
/// A single list answers two questions, so they can never disagree about which
/// files count or how each is read: whether the footage is still the footage
/// (asked every time the app comes forward, holding nothing), and which file to
/// refuse when it is not (asked under the editor's lock).
enum MediaIdentitySubject: Sendable {
    case media(ProjectMedia, expected: String)
    case audio(ProjectAudioLayer, expected: String)

    /// Every file the edit plays that is reachable and has an identity to
    /// compare against. A missing file is the offline banner's business, and a
    /// project from before fingerprints has nothing to compare.
    static func required(in project: EditorProject) -> [MediaIdentitySubject] {
        let requiredMedia = MediaAvailability.requiredMediaIDs(in: project)
        let media = project.media.compactMap { media -> MediaIdentitySubject? in
            guard requiredMedia.contains(media.id),
                  MediaAvailability.isRegularReadableFile(media.url),
                  let expected = media.sourceFingerprint
            else { return nil }
            return .media(media, expected: expected)
        }
        let audio = (project.audioLayers ?? []).compactMap { layer -> MediaIdentitySubject? in
            guard MediaAvailability.isRequired(layer, in: project),
                  layer.builtInID == nil,
                  MediaAvailability.isRegularReadableFile(layer.url),
                  let expected = layer.sourceFingerprint
            else { return nil }
            return .audio(layer, expected: expected)
        }
        return media + audio
    }

    var url: URL {
        switch self {
        case let .media(media, _): media.url
        case let .audio(layer, _): layer.url
        }
    }

    /// Reads the file and says whether it still holds the expected bytes.
    /// Saved audio is compared by its whole content, everything else by the
    /// sampled fingerprint taken at import.
    func matchesDisk() async throws -> Bool {
        switch self {
        case let .media(media, expected):
            return try await MediaSourceFingerprint.compute(url: media.url) == expected
        case let .audio(layer, expected):
            if layer.sourceKind == .saved, let exact = layer.savedAudioHash {
                return try await AudioContentHash.computeAsync(url: layer.url) == exact
            }
            return try await MediaSourceFingerprint.compute(url: layer.url) == expected
        }
    }
}
