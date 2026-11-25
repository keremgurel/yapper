import SwiftUI

/// The style library templates this project can take, and the settings of the
/// split when one is on. Every control is a registered action, so Chirpy can
/// do anything here and the receipts read the same.
struct StyleLayoutSection: View {
    @ObservedObject var session: EditorSession

    private var templates: [StyleTemplatePlan] { StyleTemplateCatalog.bundled.templates }

    /// The template the project shows: the one applied, or the full frame a
    /// project starts with.
    private var selection: String {
        if let id = session.project.appliedStyle?.templateID { return id }
        return session.project.cameraRegion == nil ? "talking-head" : ""
    }

    var body: some View {
        InspectorSection("Layout", id: "video.layout") {
            InspectorRow("Template", detail: summary) {
                InspectorSegmentedControl(
                    options: templates.map { .init(value: $0.id, label: $0.name) },
                    selection: selection,
                    onSelect: { id in Task { await session.applyStyleTemplate(id) } }
                )
            }
            if let split = session.project.styleSplitSettings {
                StyleSplitControls(session: session, split: split)
            }
        }
    }

    private var summary: String? {
        templates.first { $0.id == selection }?.summary
    }
}

/// The seam, the camera inside its half, and the top visual.
private struct StyleSplitControls: View {
    @ObservedObject var session: EditorSession
    let split: StyleSplitSettings

    var body: some View {
        InspectorRow("Seam", detail: "Lower gives the camera more room.") {
            InspectorCommitSlider(value: split.seam * 100, range: 30 ... 72, decimals: 0) { percent in
                await session.commitStyleSplit(seam: percent / 100)
            }
        }
        InspectorRow("Camera zoom") {
            InspectorCommitSlider(value: split.cameraZoom, range: 1 ... 2, decimals: 2) { zoom in
                await session.commitStyleSplit(cameraZoom: zoom)
            }
        }
        InspectorRow("Camera focus", detail: "Which part of the take stays in view. Lower it if the chin is cut off.") {
            InspectorCommitSlider(value: split.cameraFocusY * 100, range: 0 ... 100, decimals: 0) { percent in
                await session.commitStyleSplit(cameraFocusY: percent / 100)
            }
        }
        InspectorRow("Top margin") {
            InspectorCommitSlider(value: split.visualInset * 100, range: 0 ... 15, decimals: 0) { percent in
                await session.commitStyleSplit(visualInset: percent / 100)
            }
        }
        InspectorRow("Top visual") {
            HStack(spacing: 8) {
                Text(topVisualName)
                    .font(.studioBody)
                    .foregroundStyle(session.project.styleTopOverlay == nil ? Color.studioTextMuted : Color.primary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                StyleTopVisualMenu(session: session)
            }
        }
    }

    private var topVisualName: String {
        guard let overlay = session.project.styleTopOverlay else { return "Backdrop only" }
        return session.media(for: overlay)?.name ?? "Missing media"
    }
}
