import SwiftUI

/// What the window shows while sign-in is happening in the browser.
///
/// Only Google and Apple get here: they refuse to be shown inside an embedded
/// web view, so the creator is in Safari or Chrome and this window has nothing
/// to do but wait. It says that, because a window that went quiet for thirty
/// seconds read as a hung app.
struct StudioSignInView: View {
    @ObservedObject private var handoff = NativeAuthHandoff.shared
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            VStack(spacing: 16) {
                Image(systemName: "bird.fill")
                    .font(.system(size: 40, weight: .regular))
                    .foregroundStyle(Color.yapperOrange)

                VStack(spacing: 6) {
                    Text("Yapper Studio")
                        .font(.system(size: 26, weight: .black, design: .rounded))
                    Text("Finish signing in in the private sign-in window. Your regular browser account stays separate.")
                        .font(.studioBody)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 360)
                }

                ProgressView()
                    .controlSize(.small)
                    .padding(.top, 2)

                HStack(spacing: 10) {
                    Button("Open it again", action: signIn)
                        .buttonStyle(EditorSecondaryButtonStyle())
                    // The way back for somebody who changed their mind, or
                    // closed the browser tab, or would rather type a password.
                    Button("Use email instead") {
                        NativeAuthHandoff.shared.clearState()
                    }
                    .buttonStyle(EditorGhostButtonStyle())
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.studioCaption)
                        .foregroundStyle(Color.studioDanger)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 360)
                }
            }

            Spacer(minLength: 0)

            Text("Editing stays on this Mac. Your account lives with Yapper.")
                .font(.studioCaption)
                .foregroundStyle(.tertiary)
                .padding(.bottom, 22)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.editorBackground)
    }

    private func signIn() {
        errorMessage = nil
        if !NativeAuthHandoff.shared.begin() {
            errorMessage = "Couldn’t open the private sign-in window. Try again, or sign in with email here."
        }
    }
}
