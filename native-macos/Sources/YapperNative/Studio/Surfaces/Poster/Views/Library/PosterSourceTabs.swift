import SwiftUI

/// Keep every source visible even when the Studio sidebar is open.
struct PosterSourceTabs: View {
    @Binding var source: PosterSource

    private let firstRow: [PosterSource] = [.all, .yapper, .platform(.instagram)]
    private let secondRow: [PosterSource] = [.platform(.youtube), .platform(.tiktok), .uploads]

    var body: some View {
        ViewThatFits(in: .horizontal) {
            group(firstRow + secondRow)
            VStack(alignment: .leading, spacing: 5) {
                group(firstRow)
                group(secondRow)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Video sources")
    }

    private func group(_ sources: [PosterSource]) -> some View {
        HStack(spacing: 3) {
            ForEach(sources, id: \.self) { key in
                Button { source = key } label: {
                    Text(key.label)
                        .font(.studioBodyStrong)
                        .foregroundStyle(source == key ? Color.primary : Color.secondary)
                        .padding(.horizontal, 9)
                        .frame(minHeight: 32)
                        .fixedSize(horizontal: true, vertical: false)
                        .background(source == key ? Color.raisedBackground : .clear, in: Capsule())
                        .contentShape(Capsule())
                }
                .buttonStyle(.studioPlain)
                .clickableCursor()
                .accessibilityAddTraits(source == key ? .isSelected : [])
            }
        }
        .padding(3)
        .background(Color.studioInputBackground, in: Capsule())
        .fixedSize(horizontal: true, vertical: false)
    }
}
