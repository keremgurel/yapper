import SwiftUI

/// Everything done to the piece that is not writing it, behind one "..."
/// button. Editing and cross-posting need a recording first.
struct IdeaCanvasMoreMenu: View {
    let hasRecording: Bool
    let onSendToPhone: () -> Void
    let onCopyScript: () -> Void
    let onEditOnMac: () -> Void
    let onCrossPost: () -> Void

    var body: some View {
        IdeaCanvasPopoverMenu(
            options: [
                IdeaCanvasMenuOption(id: "phone", title: "Send to phone", systemImage: "iphone", action: onSendToPhone),
                IdeaCanvasMenuOption(id: "copy", title: "Copy script", systemImage: "doc.on.doc", action: onCopyScript),
                IdeaCanvasMenuOption(
                    id: "edit", title: hasRecording ? "Edit on Mac" : "Edit on Mac (record first)",
                    systemImage: "film", enabled: hasRecording, dividerBefore: true, action: onEditOnMac
                ),
                IdeaCanvasMenuOption(
                    id: "post", title: hasRecording ? "Cross-post" : "Cross-post (record first)",
                    systemImage: "paperplane", enabled: hasRecording, action: onCrossPost
                ),
            ],
            width: 230
        ) {
            Image(systemName: "ellipsis")
                .font(.system(size: 13, weight: .medium))
                .frame(width: 30, height: 30)
                .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color.raisedBackground))
                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
        }
        .help("More actions")
    }
}
