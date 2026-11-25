import SwiftUI

/// The editor's audio tab: the sound you have selected, the sounds already in
/// the project, your saved library and the shipped effects, in that order.
///
/// One column across the pane. Every block below fills it
/// so their left and right edges line up, which the old tab did not: the
/// header, the selected card, the shelf and the search each had a width of
/// their own, between 528 and 620 points.
struct AudioWorkbench: View {
    @ObservedObject var session: EditorSession

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AudioWorkbenchMetrics.sectionSpacing) {
                header

                if let selected = session.selectedAudioLayer {
                    SelectedAudioLayerEditor(session: session, layer: selected)
                }

                if let layers = session.project.audioLayers, !layers.isEmpty {
                    ProjectAudioList(session: session, layers: layers)
                }

                SoundEffectsSection(session: session)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
        }
        .inspectorPane(maxWidth: AudioWorkbenchMetrics.width + 32)
    }

    private var header: some View {
        WorkbenchPaneHeader(
            title: "Sounds",
            detail: "Click a waveform to hear it from there, then add it at the playhead."
        ) {
            Button {
                ImportPanels.openAudio(for: session)
            } label: {
                StudioGlyphLabel("Import audio", glyph: .plus, size: 13)
            }
            .buttonStyle(EditorSecondaryButtonStyle(size: .small))
            .disabled(session.project.clips.isEmpty)
            .help("Choose a music or sound file to add to this project")
        }
    }
}

/// The measurements the audio tab shares, so its blocks agree by construction.
enum AudioWorkbenchMetrics {
    /// The column every block fills.
    static let width: CGFloat = 560
    /// Between the blocks of the tab.
    static let sectionSpacing: CGFloat = 24
    /// Between a block's heading and its content.
    static let headingSpacing: CGFloat = 8
    /// Between cards in a grid.
    static let gridSpacing: CGFloat = 8
    static let cardRadius: CGFloat = 8
    /// Two cards a row at the tab's width, one when the pane is narrow.
    static let columns = [
        GridItem(.adaptive(minimum: 250), spacing: gridSpacing, alignment: .top),
    ]
}
