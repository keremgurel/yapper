import SwiftUI

/// The top of a workbench pane: what it is, a line on what it is for, and the
/// pane's own actions.
///
/// On one line when everything fits. When the pane is narrow the actions move
/// under the words rather than squeezing them: a description pressed into a
/// column four characters wide is worse than no description.
struct WorkbenchPaneHeader<Actions: View>: View {
    let title: String
    var detail: String?
    @ViewBuilder var actions: Actions

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: 12) {
                words.fixedSize()
                Spacer(minLength: 12)
                actions
            }
            VStack(alignment: .leading, spacing: 10) {
                words
                actions
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.studioSectionTitle)
            if let detail {
                Text(detail)
                    .font(.studioCaption)
                    .foregroundStyle(Color.studioTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

extension WorkbenchPaneHeader where Actions == EmptyView {
    init(title: String, detail: String? = nil) {
        self.init(title: title, detail: detail) { EmptyView() }
    }
}
