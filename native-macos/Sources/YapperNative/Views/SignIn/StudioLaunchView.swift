import SwiftUI

/// The window for the moment it takes Clerk to say whether anyone is signed
/// in. Usually a fraction of a second, so the mark only fades in if the answer
/// is slow; a quick launch goes from an empty window straight to Studio.
struct StudioLaunchView: View {
    @State private var showsMark = false

    var body: some View {
        YapperMark(size: 44)
            .opacity(showsMark ? 1 : 0)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.editorBackground)
            .task {
                try? await Task.sleep(for: .milliseconds(600))
                withAnimation(.easeOut(duration: 0.3)) { showsMark = true }
            }
    }
}
