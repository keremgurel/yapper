import Foundation

/// Home's opening line: the time of day and, when known, the creator's first
/// name. The hour is local, so a creator working at 1am is not told good
/// morning. Same wording as the web's `greeting.ts`.
enum HomeGreeting {
    static func text(hour: Int, firstName: String?) -> String {
        let phrase = switch hour {
        case 5..<12: "Good morning"
        case 12..<17: "Good afternoon"
        case 17..<22: "Good evening"
        default: "Working late"
        }
        guard let name = firstName?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty else {
            return phrase
        }
        return "\(phrase), \(name)"
    }

    /// The first word of a display name, unless the name is only an email's
    /// local part or the generic "Account".
    static func firstName(from account: StudioAccountIdentity?) -> String? {
        guard let account, account.displayName != "Account" else { return nil }
        if let email = account.email, email.hasPrefix(account.displayName + "@") { return nil }
        return account.displayName.split(separator: " ").first.map(String.init)
    }
}
