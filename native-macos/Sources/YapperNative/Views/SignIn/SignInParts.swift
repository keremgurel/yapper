import SwiftUI

/// A step's title and the one line under it.
struct SignInHeading: View {
    let title: String
    let detail: String

    var body: some View {
        VStack(spacing: 6) {
            Text(title)
                .font(.system(size: 22, weight: .semibold))
            Text(detail)
                .font(.studioBody)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// A full-width button label that swaps in a spinner while Clerk works.
struct SignInButtonLabel: View {
    let text: String
    let working: Bool

    var body: some View {
        HStack(spacing: 8) {
            if working {
                ProgressView().controlSize(.small)
            }
            Text(text)
        }
        .frame(maxWidth: .infinity)
    }
}

/// The last thing that went wrong, or nothing. Holds no space when empty.
struct SignInError: View {
    let message: String?

    var body: some View {
        if let message {
            Text(message)
                .font(.studioCaption)
                .foregroundStyle(Color.studioDanger)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)
        }
    }
}
