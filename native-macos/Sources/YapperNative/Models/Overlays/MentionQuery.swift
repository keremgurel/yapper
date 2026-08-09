import Foundation

/// The `@` being typed right now, and the files it is offering.
///
/// A value rather than a view, so the list it describes can be drawn wherever it
/// actually fits. Hanging it above the box as an overlay was the mistake: an
/// overlay is outside the layout, so nothing bounded it, and in a floating panel
/// it covered the very box you were typing into and ran off the bottom of the
/// screen at the same time.
struct MentionQuery {
    let span: OverlayMention.Span?
    /// What to offer, ranked, already capped.
    let files: [ProjectMedia]

    var isActive: Bool { !files.isEmpty }

    init(text: String, caret: Int, in library: [ProjectMedia], isDismissed: Bool) {
        let names = library.map(\.name)
        guard
            !isDismissed,
            let span = OverlayMention.mention(in: text, caret: caret),
            // A mention that has already been made stops asking to be made.
            !OverlayMention.isFinished(span, names: names)
        else {
            self.span = nil
            files = []
            return
        }
        self.span = span
        files = OverlayMention
            .suggestions(names: names, query: span.query)
            .prefix(OverlayMention.maximumSuggestions)
            .compactMap { name in library.first { $0.name == name } }
    }

    /// The text and caret after taking `file`, or nothing when there is no
    /// mention to replace.
    func accepting(_ file: ProjectMedia, in text: String) -> (text: String, caret: Int)? {
        guard let span else { return nil }
        let result = OverlayMention.applying(file.name, to: text, span: span)
        return (result.value, result.caret)
    }
}
