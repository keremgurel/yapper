import SwiftUI

/// A block's title, an optional line under it, and at most one quiet action on
/// the right. Every block of the audio tab opens with one of these, so the
/// tab reads as one list of sections rather than a pile of controls.
struct AudioSectionHeading<Trailing: View>: View {
    let title: String
    var detail: String?
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.studioBodyStrong)
                if let detail {
                    Text(detail)
                        .font(.studioCaption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 8)
            trailing()
        }
    }
}

extension AudioSectionHeading where Trailing == EmptyView {
    init(title: String, detail: String? = nil) {
        self.init(title: title, detail: detail) { EmptyView() }
    }
}
