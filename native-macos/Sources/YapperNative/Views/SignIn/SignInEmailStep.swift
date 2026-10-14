import SwiftUI

/// Step one: the address Clerk sends the code to.
struct SignInEmailStep: View {
    @ObservedObject var model: EmailSignInModel
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 20) {
            SignInHeading(
                title: "Sign in to Yapper Studio",
                detail: "Enter your email and we'll send you a 6-digit code. No password."
            )

            VStack(spacing: 10) {
                TextField("you@example.com", text: $model.email)
                    .textFieldStyle(NativeTextFieldStyle(size: 14, minHeight: 36))
                    .autocorrectionDisabled()
                    .focused($focused)
                    .disabled(model.isWorking)
                    .onSubmit(send)

                Button(action: send) {
                    SignInButtonLabel(text: "Continue with email", working: model.isWorking)
                }
                .buttonStyle(EditorPrimaryButtonStyle())
                .disabled(!model.canSend)

                SignInError(message: model.error)
            }

            Text("New here? The same code sets up your account.")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
        }
        .onAppear { focused = true }
    }

    private func send() {
        Task { await model.sendCode() }
    }
}
