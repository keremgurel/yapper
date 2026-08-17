import SwiftUI

/// The action that copies one group of settings onto every clip on the main
/// track.
///
/// One of these per group rather than one button for the lot. A single "apply
/// to all" has to mean everything, and everything is never what was wanted: a
/// finished edit is dozens of clips that were one recording, all of which want
/// the same framing and none of which want the same keyframes. Sitting inside
/// the section it copies, it can say what it does and be believed.
///
/// The count is on the face of the button rather than only in the tooltip. How
/// far an action reaches is the thing worth knowing before pressing it, and a
/// tooltip is read after.
struct ApplyToAllButton: View {
    /// What is being copied, in the words of the section it sits in.
    let what: String
    /// How many others it would land on. Nothing is shown when there are none.
    let count: Int
    var noun = "clip"
    let action: () -> Void

    var body: some View {
        if count > 0 {
            Button("Match \(count) \(count == 1 ? noun : noun + "s")") { action() }
                .buttonStyle(EditorSecondaryButtonStyle(size: .mini))
                .help("Give the other \(count) \(count == 1 ? noun : noun + "s") on this track this \(what)")
        }
    }
}
