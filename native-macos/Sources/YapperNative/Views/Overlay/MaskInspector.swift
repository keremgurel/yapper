import SwiftUI

/// The same editable masks are exposed to manual controls and Chirpy.
struct MaskInspector: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay
    let media: ProjectMedia
    @State private var regions: [SavedRevealRegion] = []
    @State private var error: String?
    @State private var editing: SavedRevealRegion?

    var body: some View {
        InspectorSection("Masks", id: "overlay.masks") {
            if let error { Text(error).font(.studioCaption).foregroundStyle(.secondary) }
            if regions.isEmpty { Text("No masked areas").font(.studioCaption).foregroundStyle(.secondary) }
            ForEach(regions) { region in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(region.label.isEmpty ? "Masked area" : region.label).font(.studioCaption)
                        Text(region.opacityKeys != nil || region.policy == .untilCue ? "Animated opacity" : "Solid cover")
                            .font(.studioCaption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Edit…") { session.pausePlayback(); editing = region }
                        .help("Change the area, color and opacity keyframes")
                }
            }
        }
        .sheet(item: $editing) { region in
            MaskEditorSheet(session: session, overlay: overlay, media: media, region: region)
        }
        .task(id: media.url) {
            do { regions = try await session.revealRegions(for: media).filter(\.hasMask); error = nil }
            catch { self.error = error.localizedDescription }
        }
    }
}
