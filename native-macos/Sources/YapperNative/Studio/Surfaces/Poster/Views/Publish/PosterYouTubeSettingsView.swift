import SwiftUI

/// YouTube's visibility, audience and synthetic-media choices for every
/// YouTube upload in the selection, the same fields as the web sheet.
struct PosterYouTubeSettingsView: View {
    @Binding var settings: PosterYouTubeSettings
    /// True when a target's YouTube description is past YouTube's byte limit.
    let descriptionTooLong: Bool
    let disabled: Bool

    var body: some View {
        NativeSection(title: "YouTube settings") {
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

                if descriptionTooLong {
                    Text("Shorten the YouTube description to 5,000 bytes or fewer before posting or scheduling.")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.studioDanger)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Text("These settings apply to every YouTube video in this selection, including scheduled uploads. Processing may continue after upload.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .font(.system(size: 13))
            .disabled(disabled)
        }
    }
}
