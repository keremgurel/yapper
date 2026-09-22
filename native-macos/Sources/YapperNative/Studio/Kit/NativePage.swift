import SwiftUI

/// The frame every native Studio page sits in: one scroll view, the shared
/// content width and gutters, the page background. Matches the web shell's
/// `StudioContentFrame` so native and web pages line up edge for edge.
struct NativePage<Content: View>: View {
    var maxWidth: CGFloat = 1440
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 0) {
                content()
            }
            .frame(maxWidth: maxWidth, alignment: .topLeading)
            .padding(.horizontal, 32)
            .padding(.top, 28)
            .padding(.bottom, 64)
            .frame(maxWidth: .infinity, alignment: .top)
        }
        .scrollIndicators(.automatic)
        .background(Color.editorBackground)
    }
}

/// The one page-title treatment: a working-size title, one line of what the
/// page is for, and the page's actions on the same row.
struct NativePageHeader<Actions: View>: View {
    let title: String
    var description: String?
    @ViewBuilder var actions: () -> Actions

    var body: some View {
        HStack(alignment: .bottom, spacing: 24) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.nativePageTitle)
                    .foregroundStyle(.primary)
                if let description {
                    Text(description)
                        .font(.system(size: 13))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: 560, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
            HStack(spacing: 8) { actions() }
        }
        .padding(.bottom, 24)
    }
}

extension NativePageHeader where Actions == EmptyView {
    init(title: String, description: String? = nil) {
        self.init(title: title, description: description) { EmptyView() }
    }
}

extension Font {
    /// 22pt semibold, the web's page title.
    static let nativePageTitle = Font.system(size: 22, weight: .semibold)
    /// 17pt semibold, a card or section title.
    static let nativeSectionTitle = Font.system(size: 15, weight: .semibold)
    /// 13pt medium, a field label in sentence case.
    static let nativeLabel = Font.system(size: 12, weight: .medium)
}
