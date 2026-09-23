import SwiftUI

/// The prompt over the top of the camera: a shade for contrast, then the
/// words moving up at the reading pace the scroller keeps.
struct TeleprompterOverlayView: View {
    let text: String
    let settings: TeleprompterSettings
    @ObservedObject var scroller: TeleprompterScroller

    @State private var textHeight: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            let height = geo.size.height * settings.heightFraction
            ZStack(alignment: .top) {
                Rectangle().fill(Color.black.opacity(settings.shade))
                Text(text)
                    .font(.system(size: TeleprompterSettings.baseFontSize * settings.fontScale, weight: .semibold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 24)
                    .frame(width: geo.size.width)
                    .background(GeometryReader { text in
                        Color.clear.preference(key: PromptHeightKey.self, value: text.size.height)
                    })
                    .offset(y: -scroller.offset)
            }
            .frame(width: geo.size.width, height: height, alignment: .top)
            .clipped()
            .onPreferenceChange(PromptHeightKey.self) { textHeight = $0 }
            .onChange(of: textHeight, initial: true) { _, value in
                scroller.maxOffset = max(0, Double(value - height))
            }
            .onChange(of: height) { _, value in
                scroller.maxOffset = max(0, Double(textHeight - value))
            }
        }
        .onChange(of: settings.pointsPerSecond, initial: true) { _, value in
            scroller.pointsPerSecond = value
        }
        .allowsHitTesting(false)
    }
}

private struct PromptHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}
