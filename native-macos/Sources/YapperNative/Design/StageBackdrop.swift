import AppKit
import SwiftUI

/// One of the stage backdrops a product moment stands on: the same pictures
/// the website uses behind its product screens, so the app's headline feature
/// and its page on ypr.app look like one thing.
enum StageBackdrop: String {
    case edit

    /// Decoded once. A backdrop is a 1400-pixel photograph and the pane that
    /// shows it is redrawn on every status change.
    @MainActor private static var cache: [StageBackdrop: Image] = [:]

    @MainActor
    var image: Image? {
        if let cached = Self.cache[self] { return cached }
        guard
            let url = AppResources.url(forResource: rawValue, withExtension: "jpg", subdirectory: "Backdrops"),
            let loaded = NSImage(contentsOf: url)
        else { return nil }
        let image = Image(nsImage: loaded)
        Self.cache[self] = image
        return image
    }
}

extension View {
    /// Stands this view on a stage. What sits on it is drawn as if the app
    /// were in dark mode, because the stage is dark in both themes.
    @MainActor
    func onStage(_ backdrop: StageBackdrop) -> some View {
        self
            .environment(\.colorScheme, .dark)
            .background {
                ZStack {
                    // Shown alone if the picture is missing, so the words on
                    // top are never white on white.
                    Color(red: 0.07, green: 0.07, blue: 0.09)
                    backdrop.image?
                        .resizable()
                        .scaledToFill()
                    // Evens out the bright streaks so white type reads the
                    // same wherever it lands on the picture.
                    Color.black.opacity(0.3)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: StudioRadius.card, style: .continuous))
    }
}
