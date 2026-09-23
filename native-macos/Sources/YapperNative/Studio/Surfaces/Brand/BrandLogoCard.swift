import SwiftUI

/// One logo: the checkerboard preview, its name and size, make primary,
/// delete. The primary logo carries a small label on the preview.
struct BrandLogoCard: View {
    let logo: BrandLogo
    let busy: Bool
    let onPrimary: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            BrandLogoPreview(logo: logo)
                .overlay(alignment: .topLeading) {
                    if logo.isPrimary {
                        NativeChip(text: "Primary", tone: .orange).padding(10)
                    }
                }
            Rectangle().fill(Color.studioLine).frame(height: 1)
            HStack(spacing: 6) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(logo.name).font(.system(size: 13, weight: .semibold)).lineLimit(1).truncationMode(.middle)
                    Text(logo.sizeLabel).font(.system(size: 11)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 4)
                if !logo.isPrimary {
                    Button(action: onPrimary) { Image(systemName: "star").font(.system(size: 12)) }
                        .buttonStyle(EditorGhostButtonStyle(size: .small))
                        .help("Make primary")
                        .accessibilityLabel("Make \(logo.name) primary")
                }
                BrandConfirmDeleteButton(label: "Remove \(logo.name)", onConfirm: onDelete)
            }
            .disabled(busy)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
        }
        .background(Color.panelBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.studioLine, lineWidth: 1))
    }
}
