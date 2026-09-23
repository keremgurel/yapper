import SwiftUI

/// Where the video comes from. "Made in Yapper" is what you made here; each
/// platform tab is what you already posted there. A dot marks a connected
/// channel.
struct PosterSourceTabs: View {
    let source: PosterSource
    let connected: [PublishPlatform]
    let onChange: (PosterSource) -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 4) {
                tab(.yapper) { Text("Made in Yapper") }
                ForEach(PublishPlatform.allCases) { platform in
                    tab(.platform(platform)) {
                        HStack(spacing: 6) {
                            Image(systemName: platform.symbol).font(.system(size: 12))
                            Text(platform.label)
                            Circle()
                                .fill(connected.contains(platform) ? NativeChip.Tone.green.color : Color.secondary.opacity(0.35))
                                .frame(width: 6, height: 6)
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            Rectangle().fill(Color.studioLine).frame(height: 1)
        }
    }

    private func tab<Label: View>(_ key: PosterSource, @ViewBuilder label: () -> Label) -> some View {
        let active = key == source
        return Button { onChange(key) } label: {
            label()
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(active ? Color.primary : Color.secondary)
                .padding(.horizontal, 12)
                .frame(height: 36)
                .overlay(alignment: .bottom) {
                    if active {
                        Capsule().fill(Color.yapperOrange).frame(height: 2).padding(.horizontal, 12)
                    }
                }
        }
        .buttonStyle(.studioPlain)
    }
}
