import SwiftUI

/// The frame every editing sheet sits in: what it is and what it does at the
/// top, the controls in the middle, and the way out at the bottom.
///
/// Cancel is always on the left and the one action that commits on the right,
/// so the two never trade places from sheet to sheet.
struct StudioSheet<Content: View, Extra: View>: View {
    let title: String
    let detail: String
    var width: CGFloat = 640
    let confirmTitle: String
    var isWorking = false
    var canConfirm = true
    var error: String?
    let onCancel: () -> Void
    let onConfirm: () -> Void
    /// Further actions that sit beside Cancel, such as removing the thing
    /// being edited.
    @ViewBuilder var extraActions: Extra
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.studioSectionTitle)
                Text(detail)
                    .font(.studioLabel)
                    .foregroundStyle(Color.studioTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)

            Rectangle().fill(Color.studioLine).frame(height: 1)

            VStack(alignment: .leading, spacing: 14) {
                content
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)

            Rectangle().fill(Color.studioLine).frame(height: 1)

            HStack(spacing: 8) {
                Button("Cancel", action: onCancel)
                    .buttonStyle(EditorSecondaryButtonStyle(size: .small))
                    .keyboardShortcut(.cancelAction)
                extraActions
                if let error {
                    Text(error)
                        .font(.studioCaption)
                        .foregroundStyle(Color.studioDanger)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Button(isWorking ? "Saving…" : confirmTitle, action: onConfirm)
                    .buttonStyle(EditorPrimaryButtonStyle(size: .small))
                    .keyboardShortcut(.defaultAction)
                    .disabled(isWorking || !canConfirm)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
        }
        .frame(width: width)
        .background(Color.panelBackground)
        .interactiveDismissDisabled(isWorking)
    }
}

extension StudioSheet where Extra == EmptyView {
    init(
        title: String,
        detail: String,
        width: CGFloat = 640,
        confirmTitle: String,
        isWorking: Bool = false,
        canConfirm: Bool = true,
        error: String? = nil,
        onCancel: @escaping () -> Void,
        onConfirm: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) {
        self.init(
            title: title, detail: detail, width: width, confirmTitle: confirmTitle,
            isWorking: isWorking, canConfirm: canConfirm, error: error,
            onCancel: onCancel, onConfirm: onConfirm,
            extraActions: { EmptyView() }, content: content
        )
    }
}
