import SwiftUI

/// The glass capsule tabs from the ypr.app hero, at toolbar size: equal slots
/// in a frosted capsule, with a clear lens that slides to the chosen one. The
/// web's `GlassTabs` with `studio-showcase-tabs-compact`, so Studio switches
/// tabs the same way in both apps.
struct NativeCapsuleTabs<Value: Hashable>: View {
    struct Tab: Identifiable {
        let value: Value
        let label: String
        var symbol: String?
        var id: Value { value }
    }

    let tabs: [Tab]
    @Binding var selection: Value
    @Namespace private var lens
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The web's compact slot: 136pt, inside a 44pt capsule with 4pt padding.
    private static var slotWidth: CGFloat { 136 }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            capsule
            ScrollView(.horizontal, showsIndicators: false) { capsule }
        }
    }

    private var capsule: some View {
        HStack(spacing: 0) {
            ForEach(tabs) { tab in slot(tab) }
        }
        .padding(4)
        .frame(height: 44)
        .studioGlass(radius: 22)
    }

    private func slot(_ tab: Tab) -> some View {
        let chosen = tab.value == selection
        return Button {
            withAnimation(reduceMotion ? nil : .spring(response: 0.34, dampingFraction: 0.82)) {
                selection = tab.value
            }
        } label: {
            HStack(spacing: 7) {
                if let symbol = tab.symbol {
                    Image(systemName: symbol).font(.system(size: 12, weight: .medium))
                }
                Text(tab.label).lineLimit(1).truncationMode(.tail)
            }
            .font(.system(size: 13, weight: chosen ? .semibold : .medium))
            .foregroundStyle(chosen ? Color.primary : Color.secondary)
            .padding(.horizontal, 12)
            .frame(width: Self.slotWidth, height: 34)
            .background {
                if chosen {
                    Capsule()
                        .fill(Color.capsuleTabLens)
                        .overlay(Capsule().strokeBorder(Color.white.opacity(0.3), lineWidth: 0.5))
                        .shadow(color: .black.opacity(0.06), radius: 4.5, y: 3)
                        .matchedGeometryEffect(id: "lens", in: lens)
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(.studioPlain)
        .clickableCursor()
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }
}

private extension Color {
    /// `--studio-tab-fill`
    static let capsuleTabLens = Color(nsColor: NSColor(name: nil) { appearance in
        appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            ? NSColor(red: 235 / 255, green: 239 / 255, blue: 1, alpha: 0.16)
            : NSColor.white.withAlphaComponent(0.64)
    })
}
