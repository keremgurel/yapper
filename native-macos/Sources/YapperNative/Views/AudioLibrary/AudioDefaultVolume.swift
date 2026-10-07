import SwiftUI

struct AudioDefaultVolume: View {
    let entryID: String
    let name: String
    @ObservedObject var volumes: AudioLibraryVolumes = .shared

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Default volume")
                .font(.studioCaption)
                .foregroundStyle(.secondary)
            VolumeSlider(
                volume: volumes.volume(for: entryID),
                onChange: { volumes.setVolume($0, for: entryID) },
                onCommit: {},
                maximum: 1,
                accessibilityName: "Default volume for \(name)"
            )
        }
        .help("Used for previews and new timeline clips. Existing clips keep their volume.")
    }
}
