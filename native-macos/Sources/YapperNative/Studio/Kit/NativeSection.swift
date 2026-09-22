import SwiftUI

/// A titled part of a page: its name, a quiet note beside it, its actions on
/// the same line, then its content. No card by default; pass `card: true`
/// for a hairline surface when the section needs to read as one object.
struct NativeSection<Content: View, Actions: View>: View {
    let title: String
    var meta: String?
    var card = false
    @ViewBuilder var actions: () -> Actions
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(title).font(.nativeSectionTitle)
                if let meta {
                    Text(meta).font(.system(size: 13)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                HStack(spacing: 4) { actions() }
            }
            content()
        }
        .padding(card ? 20 : 0)
        .background {
            if card { NativeCardBackground() }
        }
    }
}

extension NativeSection where Actions == EmptyView {
    init(title: String, meta: String? = nil, card: Bool = false, @ViewBuilder content: @escaping () -> Content) {
        self.init(title: title, meta: meta, card: card, actions: { EmptyView() }, content: content)
    }
}

/// The card surface: panel fill, hairline border, 14pt corners, no shadow.
struct NativeCardBackground: View {
    var radius: CGFloat = 14
    var body: some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        shape.fill(Color.panelBackground).overlay { shape.strokeBorder(Color.studioLine, lineWidth: 1) }
    }
}

extension View {
    /// A hairline card around this view.
    func nativeCard(padding: CGFloat = 20, radius: CGFloat = 14) -> some View {
        self.padding(padding).background(NativeCardBackground(radius: radius))
    }

    /// A sunken well: tone shift, no border. For a group inside a card.
    func nativeWell(padding: CGFloat = 14, radius: CGFloat = 10) -> some View {
        self.padding(padding)
            .background(RoundedRectangle(cornerRadius: radius, style: .continuous).fill(Color.studioInputBackground))
    }
}
