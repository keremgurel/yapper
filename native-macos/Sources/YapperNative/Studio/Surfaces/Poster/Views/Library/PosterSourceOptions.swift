import SwiftUI

struct PosterSourceOptions: View {
    let connected: [PublishPlatform]
    let onChoose: (PosterSource) -> Void
    let onUpload: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("What would you like to post?").font(.system(size: 22, weight: .bold))
            Text("Start with your latest edit, a finished file, or a video from a connected channel.")
                .font(.system(size: 13)).foregroundStyle(.secondary).padding(.top, 8).padding(.bottom, 24)
            choice("Made in Yapper", detail: "The latest finished version of each edited project.", icon: "film.stack") { onChoose(.yapper) }
            Divider()
            HStack(spacing: 12) {
                choice("Upload a video", detail: "Choose a finished file from your computer.", icon: "square.and.arrow.up", action: onUpload)
                Button("View uploads") { onChoose(.uploads) }.buttonStyle(EditorGhostButtonStyle())
            }
            Divider()
            Text("From a platform").font(.system(size: 15, weight: .semibold)).padding(.top, 20)
            Text("Choose one of your published videos to send elsewhere.").font(.system(size: 13)).foregroundStyle(.secondary).padding(.top, 6)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), spacing: 8)], spacing: 8) {
                ForEach(PublishPlatform.allCases) { platform in
                    Button { onChoose(.platform(platform)) } label: {
                        HStack(spacing: 10) {
                            Image(systemName: platform.symbol).font(.system(size: 16))
                            VStack(alignment: .leading, spacing: 3) {
                                Text(platform.label).font(.system(size: 13, weight: .semibold))
                                Text(connected.contains(platform) ? "Connected" : "Connect account").font(.system(size: 12)).foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 0)
                        }.padding(12).frame(maxWidth: .infinity, minHeight: 60).background(NativeCardBackground(radius: 8))
                    }.buttonStyle(.studioPlain)
                }
            }.padding(.top, 16)
        }.frame(maxWidth: 720).padding(.vertical, 24).frame(maxWidth: .infinity)
    }

    private func choice(_ title: String, detail: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon).font(.system(size: 22)).foregroundStyle(.secondary).frame(width: 28)
                VStack(alignment: .leading, spacing: 6) {
                    Text(title).font(.system(size: 15, weight: .semibold))
                    Text(detail).font(.system(size: 13)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                Image(systemName: "arrow.right").foregroundStyle(.secondary)
            }.frame(maxWidth: .infinity, minHeight: 88, alignment: .leading).contentShape(Rectangle())
        }.buttonStyle(.studioPlain)
    }
}
