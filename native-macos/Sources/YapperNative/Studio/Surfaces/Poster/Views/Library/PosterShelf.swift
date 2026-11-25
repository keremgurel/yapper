import SwiftUI

/// One source in the picker: its name, then its videos or what to do.
struct PosterShelf<Icon: View, Trailing: View, Content: View>: View {
    let title: String
    @ViewBuilder var icon: Icon
    @ViewBuilder var trailing: Trailing
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                icon
                Text(title).font(.studioBodyStrong).accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                trailing
            }
            content
        }
    }
}

extension PosterShelf where Trailing == EmptyView {
    init(title: String, @ViewBuilder icon: () -> Icon, @ViewBuilder content: () -> Content) {
        self.init(title: title, icon: icon, trailing: { EmptyView() }, content: content)
    }
}

/// What stands in for a shelf's videos: connect, nothing yet, or a failure.
struct PosterShelfNotice<Action: View>: View {
    let message: String
    @ViewBuilder var action: Action

    var body: some View {
        HStack(spacing: 16) {
            Text(message).font(.studioBody).foregroundStyle(.secondary)
            Spacer(minLength: 8)
            action
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: StudioRadius.card, style: .continuous).fill(Color.studioInputBackground))
    }
}

extension PosterShelfNotice where Action == EmptyView {
    init(message: String) { self.init(message: message) { EmptyView() } }
}

/// A shelf's shape while its videos load, so nothing jumps when they land.
struct PosterShelfSkeleton: View {
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ForEach(0..<8, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 6) {
                    RoundedRectangle(cornerRadius: StudioRadius.card, style: .continuous)
                        .fill(Color.studioInputBackground).aspectRatio(9 / 16, contentMode: .fit)
                    RoundedRectangle(cornerRadius: 3).fill(Color.studioInputBackground).frame(width: 96, height: 10)
                    RoundedRectangle(cornerRadius: 3).fill(Color.studioInputBackground).frame(width: 56, height: 10)
                }
                .frame(width: 124)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .clipped()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading videos")
    }
}
