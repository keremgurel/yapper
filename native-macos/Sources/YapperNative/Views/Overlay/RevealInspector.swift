import SwiftUI

/// Manual access to the same region policies and reveal events Chirpy sees.
struct RevealInspector: View {
    @ObservedObject var session: EditorSession
    let overlay: ProjectOverlay
    let media: ProjectMedia
    @State private var regions: [SavedRevealRegion] = []
    @State private var error: String?
    @State private var editing: SavedRevealRegion?

    var body: some View {
        InspectorSection("Number reveals", id: "overlay.reveals") {
            if let error { Text(error).font(.studioCaption).foregroundStyle(.secondary) }
            ForEach(regions, id: \.id) { region in
                VStack(alignment: .leading, spacing: 6) {
                    Text(region.label.isEmpty ? region.text : "\(region.label) · \(region.text)")
                        .font(.studioCaption)
                    HStack {
                        Picker("Visibility for \(region.label.isEmpty ? region.text : region.label)", selection: Binding(
                            get: { region.policy },
                            set: { policy in
                                Task {
                                    let result = await session.performAppAction(RevealPolicyInput(overlayID: overlay.id,
                                        regions: [.init(regionID: region.id, policy: policy)]))
                                    error = result.status == .applied || result.status == .unchanged ? nil : result.message
                                }
                            })) {
                                Text("Always visible").tag(RevealPolicy.alwaysVisible)
                                Text("Reveal with speech").tag(RevealPolicy.untilCue)
                                    .disabled(region.cueTime == nil)
                                Text("Always hidden").tag(RevealPolicy.alwaysHidden)
                            }
                            .labelsHidden()
                            .disabled(!session.appActions.availability(.revealPolicy, in: session).isAvailable)
                        Button("Edit…") { session.pausePlayback(); editing = region }
                            .help("Change this mask’s area, color or reveal time")
                        if region.policy == .untilCue {
                            Button("Add click") {
                                Task {
                                    let result = await session.performAppAction(RevealSoundsInput(effectID: "mouse-click",
                                        eventIDs: ["\(overlay.id.uuidString)/\(region.id)"]))
                                    error = result.status == .applied || result.status == .unchanged ? nil : result.message
                                }
                            }
                            .disabled(!session.appActions.availability(.revealSounds, in: session).isAvailable)
                        }
                    }
                }
            }
        }
        .sheet(item: $editing) { region in
            MaskEditorSheet(session: session, overlay: overlay, media: media, region: region)
        }
        .task(id: media.url) {
            do { regions = try await session.revealRegions(for: media); error = nil }
            catch { self.error = error.localizedDescription }
        }
    }
}
