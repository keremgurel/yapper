import Foundation

/// Which files a sentence is talking about, when it talks about them by name
/// rather than by `@`.
///
/// "Each time I show one of the email overlays" names a subset, and naming a
/// subset is the difference between four sounds and eleven. The `@` mention
/// list cannot help: that is for files picked from a menu, and nobody types the
/// full name of a screenshot in the middle of a sentence.
///
/// Deliberately blunt. It matches whole words shared between the sentence and a
/// file's name, so "the email ones" finds `email-open-rate.png` and a sentence
/// that names nothing finds nothing, which reads as "all of them" to every
/// caller here.
enum MediaNameMatch {
    /// Words that appear in these sentences constantly and in file names often
    /// enough to match by accident. Without them, "add a sound to the overlays"
    /// would claim any file with "sound" or "add" in its name.
    private static let ignored: Set<String> = [
        "the", "and", "each", "every", "all", "one", "ones", "any", "with",
        "add", "put", "show", "shown", "time", "times", "when", "while",
        "sound", "sounds", "effect", "effects", "sfx", "audio", "please",
        "overlay", "overlays", "cutaway", "cutaways", "clip", "clips",
        "video", "image", "images", "png", "jpg", "jpeg", "mp4", "mov",
    ]

    /// The names whose own words the sentence uses. Empty when it names none of
    /// them, which every caller reads as "no subset was asked for".
    static func mentioned(in instruction: String, names: [String]) -> [String] {
        let spoken = words(of: instruction)
        guard !spoken.isEmpty else { return [] }
        return names.filter { name in
            !words(of: name).isDisjoint(with: spoken)
        }
    }

    /// The words worth matching on: long enough to mean something, and not one
    /// of the words every one of these sentences contains.
    private static func words(of text: String) -> Set<String> {
        Set(
            text.lowercased()
                .split { !$0.isLetter && !$0.isNumber }
                .map(String.init)
                .filter { $0.count >= 3 && !ignored.contains($0) }
        )
    }
}
