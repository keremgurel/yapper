import SwiftUI

/// YouTube's visibility, audience and synthetic-media choices for the open
/// video, the same fields as the web. Folded away with the current
/// visibility in its summary, since the defaults suit most posts.
struct PosterYouTubeSettingsView: View {
    @Binding var settings: PosterYouTubeSettings

    var body: some View {
        PosterDisclosure(title: "YouTube settings", meta: settings.visibility.label) {
            VStack(alignment: .leading, spacing: 12) {
                Picker("Visibility", selection: $settings.visibility) {
                    ForEach(PosterYouTubeSettings.Visibility.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
                .clickableCursor()

                Picker("Is this content made for kids?", selection: $settings.madeForKids) {
                    Text("Choose an audience").tag(Bool?.none)
                    Text("No, it’s not made for kids").tag(Bool?.some(false))
                    Text("Yes, it’s made for kids").tag(Bool?.some(true))
                }
                .clickableCursor()

                Toggle("This content includes realistic altered or synthetic media.", isOn: $settings.syntheticMedia)
                    .toggleStyle(.checkbox)

                Text("These settings apply to this upload, including when it is scheduled. Processing may continue after upload.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .font(.system(size: 13))
        }
    }
}
