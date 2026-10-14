import SwiftUI

/// The first thing on Home: the same composer as Ideas, so a thought goes
/// from head to saved in one keystroke. A save says where it went and keeps
/// the creator here to add the next one.
struct HomeCaptureSection: View {
    let namespace: Namespace.ID
    let onExpand: () -> Void
    @ObservedObject private var actions: ComposerActions = .shared
    @State private var savedOnArrival: Int?

    private var saved: Bool {
        savedOnArrival.map { actions.savedCount > $0 } ?? false
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            IdeaComposerCard(namespace: namespace, onExpand: onExpand)
            HStack(spacing: 6) {
                if saved {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(NativeChip.Tone.green.color)
                    Text("Saved to Ideas. Yapper is shaping it into a script below.")
                    Button("Open Ideas") { StudioNavigation.shared.goTo(.ideas) }
                        .buttonStyle(.studioPlain)
                        .fontWeight(.semibold)
                        .foregroundStyle(.primary)
                        .clickableCursor()
                }
            }
            .font(.system(size: 12))
            .foregroundStyle(.secondary)
            .frame(minHeight: 18)
            .padding(.horizontal, 4)
        }
        .onAppear { savedOnArrival = actions.savedCount }
    }
}
