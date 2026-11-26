import Foundation

/// What a tapped template card calls. It goes through the registered action,
/// so a tap, a Chirpy plan and a connector take the same path.
extension EditorSession {
    func chooseOfferedStyle(_ templateID: String, from offer: StyleOffer, in messageID: UUID) async {
        let result = await performAppAction(
            StyleApplyInput(templateID: templateID, at: offer.at, until: offer.until, topMediaID: nil)
        )
        guard result.status == .applied || result.status == .unchanged else { return }
        conversation.markChosen(templateID, in: messageID)
    }
}

extension EditorSession {
    /// A card in the Styles tab: the template over the stretch it shows.
    func applyStyle(_ templateID: String, to offer: StyleOffer) async {
        await performAppAction(StyleApplyInput(templateID: templateID, at: offer.at, until: offer.until, topMediaID: nil))
    }
}
