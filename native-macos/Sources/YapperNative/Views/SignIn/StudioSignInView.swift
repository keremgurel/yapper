import SwiftUI

/// The whole window while nobody is signed in: an email, then a code.
///
/// This used to be Clerk's card inside the web view, and choosing Google on it
/// opened a private browser sheet with a second sign-in card in it before
/// Google itself. Two sign-in screens in two windows read as two different
/// products. Email codes need neither a browser nor a password, so the app
/// asks for them on one screen of its own.
struct StudioSignInView: View {
    @StateObject private var model = EmailSignInModel()

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            VStack(spacing: 22) {
                YapperMark(size: 44)
                switch model.step {
                case .email:
                    SignInEmailStep(model: model)
                        .transition(.opacity)
                case let .code(email, _):
                    SignInCodeStep(model: model, email: email)
                        .transition(.opacity)
                }
            }
            .frame(width: 320)
            .animation(.smooth(duration: 0.2), value: model.step)

            Spacer(minLength: 0)

            Text("Editing stays on this Mac. Your account lives with Yapper.")
                .font(.studioCaption)
                .foregroundStyle(.tertiary)
                .padding(.bottom, 22)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.editorBackground)
    }
}
