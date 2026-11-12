import SwiftUI

struct PosterStepProgress: View {
    let composing: Bool

    var body: some View {
        HStack(spacing: 12) {
            step("Source", number: 1, current: !composing)
            step("Post", number: 2, current: composing)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(composing ? "Step 2 of 2: Post" : "Step 1 of 2: Source")
    }

    private func step(_ label: String, number: Int, current: Bool) -> some View {
        HStack(spacing: 5) {
            Text(String(number)).font(.system(size: 10, weight: .semibold))
                .frame(width: 20, height: 20)
                .background(current ? Color.studioAccent : Color.studioInputBackground, in: Circle())
                .foregroundStyle(current ? Color.studioAccentForeground : Color.studioTextMuted)
            Text(label).font(.system(size: 12, weight: current ? .semibold : .regular))
                .foregroundStyle(current ? .primary : .secondary)
        }
    }
}

struct PosterComposerRow<Content: View>: View {
    let label: String
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 16) {
                Text(label).font(.system(size: 13, weight: .semibold))
                    .frame(width: 108, alignment: .leading)
                    .padding(.top, 7)
                content().frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 14)
            Divider()
        }
    }
}
