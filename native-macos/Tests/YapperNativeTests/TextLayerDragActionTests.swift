import Foundation
import Testing
@testable import YapperNative

private actor DragTestStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {}
}

/// A finished drag on a text layer commits through the same actions Chirpy
/// plans, so a drag and a request for the same values save the same project.
@MainActor
struct TextLayerDragActionTests {
    private func session() async -> (EditorSession, ProjectTextLayer) {
        let session = EditorSession(store: DragTestStore())
        await Task.yield()
        let layer = ProjectTextLayer(text: "Hook", timelineStart: 1)
        session.updateProject { $0 = EditorProject(name: "Drag", textLayers: [layer]) }
        return (session, layer)
    }

    @Test func canvasDragMatchesTheStyleActionChirpyUses() async throws {
        let (drag, layer) = await session()
        let (chat, _) = await session()
        chat.updateProject { $0.textLayers = [layer] }
        var moved = layer
        moved.x = 0.3; moved.y = 0.7; moved.rotation = 15
        let result = await drag.commitTextLayerDraft(moved).value
        #expect(result?.action == "editor.text.setStyle" && result?.status == .applied)
        await chat.performAppAction(TextLayerStyleInput(textLayerIDs: [layer.id],
            style: TextStyleInput(TextStylePatch(x: 0.3, y: 0.7, rotation: 15))))
        #expect(drag.project.textLayers == chat.project.textLayers)
        #expect(drag.project.textLayers?.first?.x == 0.3)
    }

    @Test func timelineMoveMatchesTheUpdateAction() async throws {
        let (drag, layer) = await session()
        let (chat, _) = await session()
        chat.updateProject { $0.textLayers = [layer] }
        var moved = layer
        moved.timelineStart = 0.5
        moved.duration = 2
        let result = await drag.commitTextLayerDraft(moved).value
        #expect(result?.action == "editor.text.update")
        await chat.performAppAction(TextLayerUpdateInput(textLayerID: layer.id, text: nil, timelineStart: 0.5, duration: 2))
        #expect(drag.project.textLayers == chat.project.textLayers)
        #expect(drag.project.textLayers?.first?.x == layer.x)
    }

    @Test func aDropWithNothingChangedCommitsNothing() async throws {
        let (drag, layer) = await session()
        #expect(await drag.commitTextLayerDraft(layer).value == nil)
        #expect(drag.appActions.recentResults.isEmpty)
    }

    @Test func resizingStopsAtTheSameNarrowestWidthAsTheAction() {
        var layer = ProjectTextLayer(text: "Hook", timelineStart: 0)
        layer.width = 0.21
        let shrunk = TextCanvasGeometry.resized(layer: layer, translation: CGSize(width: -400, height: 0),
            corner: .bottomTrailing, canvasSize: CGSize(width: 1000, height: 600))
        #expect(shrunk.width == TextStyle.minimumWidth)
    }
}
