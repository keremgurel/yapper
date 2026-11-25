import SwiftUI

/// Which shelf of the sound library is showing.
enum SoundLibraryTab: Hashable, Identifiable {
    case yours
    case all
    case category(SoundEffectCategory)

    static var allCases: [SoundLibraryTab] { [.yours, .all] + SoundEffectCategory.allCases.map { .category($0) } }

    var id: String {
        switch self {
        case .yours: "yours"
        case .all: "all"
        case let .category(category): category.rawValue
        }
    }

    var title: String {
        switch self {
        case .yours: "Yours"
        case .all: "All"
        case let .category(category): category.title
        }
    }
}

/// The shelves as text tabs, the picked one underlined, scrolling sideways
/// when the pane is narrow.
struct SoundLibraryTabs: View {
    @Binding var selection: SoundLibraryTab
    @Namespace private var underline

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 18) {
                ForEach(SoundLibraryTab.allCases) { tab in
                    let isOn = tab == selection
                    Button {
                        withAnimation(.easeOut(duration: 0.16)) { selection = tab }
                    } label: {
                        VStack(spacing: 6) {
                            Text(tab.title)
                                .font(isOn ? .studioBodyStrong : .studioBody)
                                .foregroundStyle(isOn ? Color.primary : Color.studioTextMuted)
                                .fixedSize()
                            ZStack {
                                Capsule().fill(Color.clear).frame(height: 2)
                                if isOn {
                                    Capsule().fill(Color.primary).frame(height: 2)
                                        .matchedGeometryEffect(id: "tab", in: underline)
                                }
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.studioPlain)
                    .accessibilityAddTraits(isOn ? .isSelected : [])
                }
            }
            .padding(.horizontal, 1)
        }
        .overlay(alignment: .bottom) { Rectangle().fill(Color.studioLine).frame(height: 1).offset(y: 0.5) }
    }
}
