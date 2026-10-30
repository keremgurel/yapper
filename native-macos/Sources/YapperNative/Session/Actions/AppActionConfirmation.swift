import AppKit

/// What the creator is asked before Chirpy runs an action marked `confirm` in
/// the contract. Clicking the matching control is already the creator's
/// decision; a model's plan is not, so only the assistant path asks.
struct AppActionConfirmation: Equatable, Sendable {
    let title: String
    let detail: String
    let confirmLabel: String

    @MainActor
    static func askWithAlert(_ confirmation: AppActionConfirmation) async -> Bool {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = confirmation.title
        alert.informativeText = confirmation.detail
        alert.addButton(withTitle: confirmation.confirmLabel)
        alert.addButton(withTitle: "Cancel")
        return alert.runModal() == .alertFirstButtonReturn
    }
}
