import SwiftUI

/// The whole window, when nobody is signed in.
///
/// The app used to show its full self to a signed-out creator: a sidebar of
/// tabs, each one loading a web page that said "Sign in". Eleven doors, all
/// locked, and the same key behind every one of them. There is only one thing
/// to do here, so this is the only thing on screen.
struct StudioSignInView: View {
    @State private var isWaiting = false
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
                    Text("Sign in to reach your projects, ideas and connected accounts.")
                        .font(.studioBody)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 360)
                }

                Button(action: signIn) {
                    Text(isWaiting ? "Waiting for your browser…" : "Sign in")
                        .frame(minWidth: 150)
                }
                .buttonStyle(EditorPrimaryButtonStyle())
                .disabled(isWaiting)
                .padding(.top, 4)

                if isWaiting {
                    // Said plainly, because the window goes quiet while the
                    // browser has the person's attention, and a stalled login
                    // otherwise looks like a stuck app.
                    VStack(spacing: 8) {
                        Text("Finish signing in in your browser. This window updates by itself.")
                            .font(.studioCaption)
                            .foregroundStyle(.secondary)
                        Button("Open it again", action: signIn)
                            .buttonStyle(EditorGhostButtonStyle())
                    }
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
        guard NativeAuthHandoff.shared.begin() else {
            errorMessage = "Couldn’t open your browser. Open ypr.app and sign in there."
            return
        }
        isWaiting = true
    }
}
