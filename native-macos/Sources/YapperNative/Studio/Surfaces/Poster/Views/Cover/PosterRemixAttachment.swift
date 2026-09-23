import SwiftUI

/// One image going into the remix, shown at its own shape like an attachment
/// in a message: a label in the corner and a button to take it out (or, for
/// a frame that was left out, put it back).
struct PosterRemixAttachment: View {
    static let height: CGFloat = 132

    let image: CGImage
    let label: String
    let included: Bool
    let toggleHelp: String
    let onToggle: () -> Void

    private var width: CGFloat {
        let aspect = CGFloat(image.width) / CGFloat(max(image.height, 1))
        return min(max(Self.height * aspect, 64), 236)
    }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 8, style: .continuous)
        Image(decorative: image, scale: 1).resizable().scaledToFill()
            .frame(width: width, height: Self.height)
            .clipShape(shape)
            .overlay(shape.strokeBorder(Color.studioLine, lineWidth: 1))
            .opacity(included ? 1 : 0.35)
            .overlay(alignment: .bottomLeading) {
                Text(label)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(Capsule().fill(.black.opacity(0.6)))
                    .padding(6)
            }
            .overlay(alignment: .topTrailing) {
                Button(action: onToggle) {
                    Image(systemName: included ? "xmark" : "plus")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 20, height: 20)
                        .background(Circle().fill(.black.opacity(0.6)))
                }
                .buttonStyle(.studioPlain)
                .clickableCursor()
                .help(toggleHelp)
                .padding(6)
            }
    }
}
