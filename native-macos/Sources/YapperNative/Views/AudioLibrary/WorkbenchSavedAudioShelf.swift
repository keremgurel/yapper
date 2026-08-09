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

    private let columns = [
        GridItem(.adaptive(minimum: 218, maximum: 260), spacing: 8, alignment: .top),
    ]

    private var saved: [SavedAudio] {
        store.items
            .filter { !store.missingIDs.contains($0.id) }
            .sorted { $0.addedAt > $1.addedAt }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 8) {
                Text("YOURS")
                    .font(.studioCaptionStrong)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 8)
                Button("Open library", action: openLibrary)
                    .buttonStyle(EditorGhostButtonStyle())
            }

            if saved.isEmpty {
                Text("Music and sounds you save show up here, in every project.")
                    .font(.studioCaption)
                    .foregroundStyle(.tertiary)
            } else {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 8) {
                    ForEach(saved) { item in
                        SavedAudioCard(
                            item: item,
                            disabled: session.project.clips.isEmpty,
                            isPlaying: preview.isPlaying(item),
                            preview: {
                                // One sound at a time across the whole tab: the
                                // shelf above this one has a preview of its own.
                                session.stopSoundPreview()
                                preview.toggle(item, at: store.url(for: item))
                            },
                            add: {
                                preview.stop()
                                Task { await session.addSavedAudio(item, at: store.url(for: item)) }
                            }
                        )
                    }
                }
            }
        }
        .frame(maxWidth: 528, alignment: .leading)
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

/// One saved sound, drawn as the shipped effects are so the two shelves read as
/// one library rather than two features.
private struct SavedAudioCard: View {
    let item: SavedAudio
    let disabled: Bool
    let isPlaying: Bool
    let preview: () -> Void
    let add: () -> Void

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: item.kind.icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.yapperOrange)
                .frame(width: 28, height: 28)
                .background(Color.yapperOrange.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 6))

            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .font(.studioBodyStrong)
                    .lineLimit(1)
                Text("\(item.kind.itemTitle) · \(AudioLength.short(item.duration))")
                    .font(.studioCaption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)

            Button(action: preview) {
                Image(systemName: isPlaying ? "stop.fill" : "play.fill")
                    .font(.system(size: 10, weight: .bold))
                    .frame(width: 27, height: 27)
            }
            .buttonStyle(.studioPlain)
            .clickableCursor()
            .foregroundStyle(isPlaying ? Color.yapperOrange : Color.primary)
            .background(isPlaying ? Color.yapperOrange.opacity(0.14) : Color.studioFaintFill)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .help(isPlaying ? "Stop" : "Preview \(item.name)")

            Button(action: add) {
                Image(systemName: "plus")
                    .font(.system(size: 11, weight: .bold))
                    .frame(width: 27, height: 27)
            }
            .buttonStyle(.studioPlain)
            .clickableCursor()
            .foregroundStyle(disabled ? Color.secondary : Color.white)
            .background(disabled ? Color.studioFaintFill : Color.yapperOrange)
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .disabled(disabled)
            .help("Add \(item.name) at playhead")
        }
        .padding(.horizontal, 9)
        .frame(width: 260, height: 54, alignment: .leading)
        .background(Color.raisedBackground)
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.studioLine, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
