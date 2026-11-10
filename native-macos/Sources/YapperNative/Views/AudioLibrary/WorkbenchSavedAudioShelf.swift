import SwiftUI

/// The creator's own saved audio, on the editor's audio tab.
///
/// The library is a tab of its own, but reaching for a sound happens here, with
/// the timeline in front of you. So the shelf comes to the work rather than the
/// work going to the shelf, and both read from the one store.
struct WorkbenchSavedAudioShelf: View {
    @ObservedObject var session: EditorSession
    @ObservedObject var store: AudioLibraryStore

    @StateObject private var preview = SavedAudioPreview()
    /// The shell's own tab, written straight to rather than threaded down as a
    /// callback through five views that have no other reason to know about
    /// navigation.
    @AppStorage("studioDestination") private var destinationRaw = StudioDestination.home.rawValue

    private var saved: [SavedAudio] {
        store.items
            .filter { !store.missingIDs.contains($0.id) }
            .sorted { $0.addedAt > $1.addedAt }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AudioWorkbenchMetrics.headingSpacing) {
            // The one way to the library from here. Default volumes for each
            // sound are set there too, which the old second button on this tab
            // ("Browse audio and set default volumes") said at more length.
            AudioSectionHeading(
                title: "Your music and sounds",
                detail: saved.isEmpty ? "Music and sounds you save show up here, in every project." : nil
            ) {
                Button("Open library", action: openLibrary)
                    .buttonStyle(EditorGhostButtonStyle())
                    .help("Browse your audio and set default volumes")
            }

            if !saved.isEmpty {
                LazyVGrid(
                    columns: AudioWorkbenchMetrics.columns,
                    alignment: .leading,
                    spacing: AudioWorkbenchMetrics.gridSpacing
                ) {
                    ForEach(saved) { item in
                        AudioItemCard(
                            icon: item.kind.icon,
                            title: item.name,
                            detail: "\(item.kind.itemTitle) · \(AudioLength.short(item.duration))",
                            disabled: session.project.clips.isEmpty,
                            isPlaying: preview.isPlaying(item),
                            preview: {
                                // One sound at a time across the whole tab.
                                session.stopSoundPreview()
                                preview.toggle(item, at: store.url(for: item))
                            },
                            add: {
                                preview.stop()
                                Task { await session.addSavedAudio(item, from: store) }
                            }
                        )
                    }
                }
            }
        }
        .onChange(of: session.previewingSoundID) { _, playing in
            if playing != nil { preview.stop() }
        }
        .onDisappear(perform: preview.stop)
    }

    private func openLibrary() {
        preview.stop()
        session.pausePlayback()
        destinationRaw = StudioDestination.audio.rawValue
    }
}
