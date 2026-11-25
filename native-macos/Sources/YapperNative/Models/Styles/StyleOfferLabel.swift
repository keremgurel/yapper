import Foundation

/// How an offer names the stretch it is for, in Chirpy's reply and on the cards.
enum StyleOfferLabel {
    static func range(_ offer: StyleOffer) -> String {
        guard offer.at != nil else { return "the whole video" }
        return "\(clock(offer.start)) to \(clock(offer.end))"
    }

    static func clock(_ seconds: Double) -> String {
        let total = max(0, Int(seconds.rounded()))
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}
