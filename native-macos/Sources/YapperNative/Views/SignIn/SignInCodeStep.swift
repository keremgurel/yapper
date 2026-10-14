import SwiftUI

/// Step two: the code from the email. Six digits sign in on their own, so a
/// pasted or autofilled code needs no click.
struct SignInCodeStep: View {
    @ObservedObject var model: EmailSignInModel
    let email: String
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 20) {
            SignInHeading(
                title: "Check your email",
                detail: "Enter the 6-digit code we sent to \(email)."
            )

            VStack(spacing: 10) {
                TextField("000000", text: Binding(get: { model.code }, set: { model.updateCode($0) }))
                    .textFieldStyle(.plain)
                    .textContentType(.oneTimeCode)
                    .font(.system(size: 24, weight: .semibold, design: .monospaced))
                    .tracking(8)
                    .multilineTextAlignment(.center)
                    .frame(height: 52)
                    .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.studioInputBackground))
                    .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
                    .focused($focused)
                    .disabled(model.isWorking)
                    .onSubmit(verify)

                Button(action: verify) {
                    SignInButtonLabel(text: "Sign in", working: model.isWorking)
                }
                .buttonStyle(EditorPrimaryButtonStyle())
                .disabled(model.isWorking || model.code.count < EmailSignInModel.codeLength)

                SignInError(message: model.error)
            }

            HStack(spacing: 6) {
                Button("Use a different email", action: model.useDifferentEmail)
                    .buttonStyle(EditorGhostButtonStyle())
                SignInResendButton(model: model)
            }
        }
        .onAppear { focused = true }
    }

    private func verify() {
        Task { await model.verify() }
    }
}

/// "Send a new code", counting down while Clerk would refuse another.
private struct SignInResendButton: View {
    @ObservedObject var model: EmailSignInModel

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let wait = Int(model.resendAvailableAt.timeIntervalSince(context.date).rounded(.up))
            Button(wait > 0 ? "Send a new code in \(wait)s" : "Send a new code") {
                Task { await model.resend() }
            }
            .buttonStyle(EditorGhostButtonStyle())
            .monospacedDigit()
            .disabled(wait > 0 || model.isWorking)
        }
    }
}
