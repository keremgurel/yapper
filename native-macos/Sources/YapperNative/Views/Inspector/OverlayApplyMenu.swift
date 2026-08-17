import SwiftUI

/// The action that copies one overlay's size and position onto others, with a
/// choice of how far it reaches.
///
/// A menu rather than a button because overlays, unlike clips, sit on lanes,
/// and the two reaches are wanted about equally often: a lane of talking-head
/// inserts wants to match itself, and a project whose cutaways all sit in the
/// same corner wants to match across every lane. Either would be the wrong
/// default for the other, so neither is the default.
///
/// Both items carry their own count, taken from the same call that does the
/// copying, so an item promising three overlays cannot change two. An item with
/// nothing to land on is not offered, and when neither has anything the whole
/// menu is absent.
struct OverlayApplyMenu: View {
    /// What is being copied, in the words of the section it sits in.
    let what: String
    /// Which lane the overlay sits on, counting from 1 the way the track rail
    /// labels them.
    let lane: Int
    let laneCount: Int
    let projectCount: Int
    let apply: (ApplyToAll.OverlayScope) -> Void

    var body: some View {
        if projectCount > 0 {
            Menu("Match...") {
                if laneCount > 0 {
                    Button("Others on lane \(lane) (\(laneCount))") { apply(.lane) }
                }
                // Offered only when it would reach past the lane, so the menu
                // never shows the same action twice under two names.
                if projectCount > laneCount {
                    Button("All overlays (\(projectCount))") { apply(.project) }
                }
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
            .help("Give other overlays this \(what)")
        }
    }
}
