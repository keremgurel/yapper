import CoreImage.CIFilterBuiltins
import SwiftUI

/// The teleprompter handoff: a QR that opens this script on the phone,
/// signed in. The code is minted only when asked for and visibly expires.
struct IdeaCanvasPhoneSheet: View {
    let itemID: String
    let beforeOpen: () async throws -> Void
    let onClose: () -> Void
    @StateObject private var handoff = IdeaCanvasPhoneHandoff()

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Send to phone").font(.nativeSectionTitle)
                Text("Opens this script in the teleprompter on your phone.")
                    .font(.system(size: 13)).foregroundStyle(.secondary)
            }
            content.frame(maxWidth: .infinity)
            HStack {
                Spacer()
                Button("Done", action: onClose).buttonStyle(EditorSecondaryButtonStyle(size: .small))
            }
        }
        .padding(24)
        .frame(width: 340)
        .onDisappear { handoff.reset() }
    }

    @ViewBuilder private var content: some View {
        switch handoff.phase {
        case .ready(let url):
            VStack(spacing: 8) {
                IdeaCanvasQRCode(value: url)
                    .frame(width: 148, height: 148)
                    .padding(12)
                    // Always on white: a QR needs its light modules light.
                    .background(RoundedRectangle(cornerRadius: 8).fill(Color.white))
                Text("Scan with your phone camera. Expires in \(handoff.secondsLeft)s.")
                    .font(.system(size: 12)).foregroundStyle(.secondary)
            }
        default:
            VStack(spacing: 6) {
                Button { Task { await handoff.mint(itemID: itemID, beforeOpen: beforeOpen) } } label: {
                    HStack(spacing: 6) {
                        if handoff.phase == .minting { ProgressView().controlSize(.small) } else { Image(systemName: "iphone") }
                        Text(handoff.phase == .expired ? "Show a new code" : "Show the code")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(EditorSecondaryButtonStyle(size: .regular))
                .disabled(handoff.phase == .minting)
                if handoff.phase == .failed {
                    Text("Couldn't save the latest script or create a code. Try again.")
                        .font(.system(size: 12)).foregroundStyle(Color.studioDanger)
                } else if handoff.phase == .expired {
                    Text("That code expired.").font(.system(size: 12)).foregroundStyle(.secondary)
                }
            }
        }
    }
}

/// A crisp QR image for a string.
struct IdeaCanvasQRCode: View {
    let value: String

    var body: some View {
        if let image = Self.render(value) {
            Image(nsImage: image).interpolation(.none).resizable().scaledToFit()
        } else {
            Color.white
        }
    }

    static func render(_ value: String) -> NSImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(value.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 8, y: 8)),
              let cgImage = CIContext().createCGImage(output, from: output.extent) else { return nil }
        return NSImage(cgImage: cgImage, size: NSSize(width: output.extent.width, height: output.extent.height))
    }
}
