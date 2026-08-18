import SwiftUI

/// The rubber band, and the only thing that redraws while one is being dragged.
///
/// It used to live in `@State` on the timeline content, which meant every
/// pointer move rebuilt the whole track stack — every clip, cutaway, caption
/// and sound cell — to move a rectangle. Held here instead, the band repaints
/// on its own and the tracks are left alone until the selection itself
/// actually changes.
@MainActor
final class TimelineMarqueeState: ObservableObject {
    @Published private(set) var start: CGPoint?
    @Published private(set) var current: CGPoint?
    /// True once the pointer has travelled far enough to mean a band rather
    /// than a click.
    @Published private(set) var isActive = false
    /// What the band covers while it is being dragged.
    ///
    /// Kept here rather than written to the session on every pointer move: the
    /// session is watched by the inspector, the transcript, the caption list
    /// and the player, and republishing it thirty times a second relaid all of
    /// them out to draw an orange border on a few cells. The timeline reads
    /// this alongside the real selection while a band is live, and the session
    /// hears the answer once, when the band is let go.
    @Published private(set) var caught: Set<TimelineSelectionItem> = []

    /// What the band covers right now, or nil while it is still a click.
    var rect: CGRect? {
        guard isActive, let start, let current else { return nil }
        return TimelineMarqueeGeometry.rect(from: start, to: current)
    }

    var origin: CGPoint? { start }

    func begin(at point: CGPoint, current: CGPoint) {
        start = point
        self.current = current
    }

    func drag(to point: CGPoint) {
        current = point
        isActive = true
    }

    func catching(_ selection: Set<TimelineSelectionItem>) {
        guard selection != caught else { return }
        caught = selection
    }

    /// Whether the band has this item, which the cells ask alongside the
    /// session's own answer.
    func holds(_ item: TimelineSelectionItem) -> Bool {
        isActive && caught.contains(item)
    }

    func end() {
        start = nil
        current = nil
        isActive = false
        caught = []
    }
}

struct TimelineMarqueeBox: View {
    @ObservedObject var state: TimelineMarqueeState

    var body: some View {
        if let rect = state.rect {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(Color.yapperOrange.opacity(0.12))
                .overlay {
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .stroke(Color.yapperOrange.opacity(0.92), lineWidth: 1)
                }
                .frame(width: rect.width, height: rect.height)
                .offset(x: rect.minX, y: rect.minY)
                .allowsHitTesting(false)
        }
    }
}
