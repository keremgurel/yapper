import Foundation

struct StudioCreditMeter: Decodable, Equatable {
    let fraction: Double?
    let allowance: Int?
    let lightColor: String
    let darkColor: String
    let planLabel: String

    var clampedFraction: Double? {
        fraction.flatMap { $0.isFinite ? min(1, max(0, $0)) : nil }
    }
}

/// A one-time credit pack the account menu offers as a one-click top-up.
struct StudioCreditPack: Decodable, Equatable, Identifiable {
    let key: String
    let credits: Int
    let priceLabel: String

    var id: String { key }

    /// The pricing page starts this pack's checkout for a signed-in member,
    /// so the top-up is one click here and one confirmation at Stripe.
    var checkoutURL: URL? {
        var components = URLComponents(string: "https://ypr.app/pricing")
        components?.queryItems = [URLQueryItem(name: "buy", value: key)]
        components?.fragment = "credits"
        return components?.url
    }
}

struct StudioBillingSnapshot: Decodable, Equatable {
    let balance: Int
    let entitled: Bool
    // Optional so the native app also works against an older server build.
    let creditMeter: StudioCreditMeter?
    let packs: [StudioCreditPack]?
}

/// Shared display-only balance. Refresh on account changes, foreground, opening
/// the menu and completed work. No generation or paid AI calls are made here.
@MainActor
final class StudioBilling: ObservableObject {
    static let shared = StudioBilling()
    @Published private(set) var snapshot: StudioBillingSnapshot?
    private var owner: String?
    private var generation = 0

    func snapshot(for userID: String?) -> StudioBillingSnapshot? {
        userID != nil && owner == userID ? snapshot : nil
    }

    func refresh(userID: String?) async {
        if owner != userID {
            owner = userID
            snapshot = nil
        }
        generation += 1
        let requestGeneration = generation
        guard userID != nil else { return }
        do {
            let data = try await APITransport.send("api/billing/status", method: "GET")
            let result = try JSONDecoder().decode(StudioBillingSnapshot.self, from: data)
            guard generation == requestGeneration, !Task.isCancelled else { return }
            snapshot = result
        } catch {
            guard generation == requestGeneration else { return }
            snapshot = nil
        }
    }
}

extension Notification.Name {
    static let studioAccountBalanceChanged = Notification.Name("studioAccountBalanceChanged")
}
