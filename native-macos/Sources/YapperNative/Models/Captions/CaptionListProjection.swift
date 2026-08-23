import Foundation

/// The caption editor shows cards that currently have something to edit.
///
/// Generated cards whose every transcript word was cut stay in the project so
/// restoring those words can restore the card, but exposing those retained
/// placeholders as numbered blank rows made them look like broken captions.
/// A newly inserted empty card is the one exception: it stays visible while it
/// owns the caret so the creator can type into it.
enum CaptionListProjection {
    static func visibleCaptions(
        from captions: [ProjectCaption],
        textsByID: [UUID: String],
        focusedID: UUID? = nil,
        retainingIDs: Set<UUID> = []
    ) -> [ProjectCaption] {
        captions.filter { caption in
            caption.id == focusedID
                || retainingIDs.contains(caption.id)
                || hasVisibleText(textsByID[caption.id] ?? caption.text)
        }
    }

    static func visibleCount(
        in captions: [ProjectCaption],
        textsByID: [UUID: String]
    ) -> Int {
        captions.lazy.filter { caption in
            hasVisibleText(textsByID[caption.id] ?? caption.text)
        }.count
    }

    private static func hasVisibleText(_ text: String) -> Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
