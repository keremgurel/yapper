import SwiftUI

/// The shape of a page while its first read is in flight.
struct NativeLoadingState: View {
    var label = "Loading…"
    var body: some View {
        HStack(spacing: 8) {
            ProgressView().controlSize(.small)
            Text(label).font(.system(size: 13)).foregroundStyle(.secondary)
        }
        .padding(.vertical, 24)
    }
}

/// A read that failed, with the one action that fixes it.
struct NativeErrorState: View {
    let message: String
    var retry: (() -> Void)?
    var body: some View {
        HStack(spacing: 12) {
            Text(message).font(.system(size: 13)).foregroundStyle(Color.studioDanger)
            Spacer(minLength: 0)
            if let retry {
                Button("Try again", action: retry).buttonStyle(EditorSecondaryButtonStyle(size: .small))
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.studioDanger.opacity(0.08)))
    }
}

/// Nothing here yet: a sunken icon circle, one sentence, one action.
struct NativeEmptyState<Action: View>: View {
    let systemImage: String
    let title: String
    var message: String?
    @ViewBuilder var action: () -> Action

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 17))
                .foregroundStyle(.secondary)
                .frame(width: 40, height: 40)
                .background(Circle().fill(Color.studioInputBackground))
            Text(title).font(.system(size: 13, weight: .semibold))
            if let message {
                Text(message).font(.system(size: 12)).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center).frame(maxWidth: 360)
            }
            action()
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 36)
    }
}

extension NativeEmptyState where Action == EmptyView {
    init(systemImage: String, title: String, message: String? = nil) {
        self.init(systemImage: systemImage, title: title, message: message) { EmptyView() }
    }
}
