import SwiftUI

struct PosterYouTubeSettingsView: View {
    @Binding var settings: PosterYouTubeSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 10) {
                GridRow {
                    Text("Visibility")
                    Picker("Visibility", selection: $settings.visibility) {
                        ForEach(PosterYouTubeSettings.Visibility.allCases) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    .labelsHidden()
                    .clickableCursor()
                }
                GridRow {
                    Text("Made for kids?")
                    Picker("Made for kids?", selection: $settings.madeForKids) {
                        Text("Choose an audience").tag(Bool?.none)
                        Text("No, it’s not made for kids").tag(Bool?.some(false))
                        Text("Yes, it’s made for kids").tag(Bool?.some(true))
                    }
                    .labelsHidden()
                    .clickableCursor()
                }
            }
            Toggle("This content includes realistic altered or synthetic media.", isOn: $settings.syntheticMedia)
                .toggleStyle(.checkbox)
        }
        .font(.system(size: 13))
    }
}
