import AppKit
import Foundation
import Testing
@testable import YapperNative

@MainActor
struct SceneLayoutQualityTests {
    @Test func fitsIntrinsicTextHeightWithoutEnlargingOrMovingText() throws {
        let draft = try scene([
            ["id":"label", "type":"text", "text":"Facebook", "x":0.08,"y":0.1,"width":0.84,"height":0.1,"size":0.15],
        ])
        let fitted = SceneLayoutQuality.fittingTextBoxes(scene:draft,size:CGSize(width:254,height:160))
        #expect(fitted.nodes[0].height > draft.nodes[0].height)
        #expect(fitted.nodes[0].size == draft.nodes[0].size)
        #expect(fitted.nodes[0].x == draft.nodes[0].x)
        #expect(fitted.nodes[0].y == draft.nodes[0].y)
        #expect(fitted.nodes[0].width == draft.nodes[0].width)
        #expect(SceneLayoutQuality.issues(scene:fitted,size:CGSize(width:254,height:160)).isEmpty)
    }
    @Test func intrinsicSizingDoesNotBypassCollisionOrBoundsChecks() throws {
        let draft = try scene([
            ["id":"a", "type":"text", "text":"Facebook", "x":0.08,"y":0.85,"width":0.84,"height":0.1,"size":0.2],
            ["id":"b", "type":"text", "text":"Reddit", "x":0.08,"y":0.9,"width":0.84,"height":0.1,"size":0.2],
        ])
        let fitted = SceneLayoutQuality.fittingTextBoxes(scene:draft,size:CGSize(width:254,height:160))
        let issues = SceneLayoutQuality.issues(scene:fitted,size:CGSize(width:254,height:160))
        #expect(issues.contains { $0.contains("overlaps") })
        #expect(issues.contains { $0.contains("outside") })
    }
    private func scene(_ nodes: [[String: Any]], animations: [[String: Any]] = []) throws -> OverlayScene {
        try #require(SceneValidator.validate(["version": 1, "duration": 4, "nodes": nodes, "animations": animations])).scene
    }
    @Test func catchesTheCheckInTextCollision() throws {
        let draft = try scene([
            ["id":"earlier", "type":"text", "text":"EARLIER", "x":0.1,"y":0.16,"width":0.4,"height":0.2,"size":0.15],
            ["id":"users", "type":"number", "from":324,"to":324,"x":0.1,"y":0.2,"width":0.28,"height":0.2,"size":0.155],
            ["id":"label", "type":"text", "text":"successful payments", "x":0.29,"y":0.335,"width":0.42,"height":0.1,"size":0.15],
        ])
        let issues = SceneLayoutQuality.issues(scene: draft, size: CGSize(width:254,height:160))
        #expect(issues.contains { $0.contains("overlaps") })
        #expect(issues.contains { $0.contains("overflows") })
    }
    @Test func acceptsReadableCounterAndSequentialLabels() throws {
        let draft = try scene([
            ["id":"a", "type":"text", "text":"SIGNUPS", "x":0.08,"y":0.08,"width":0.84,"height":0.25,"size":0.15],
            ["id":"b", "type":"text", "text":"NOW", "x":0.08,"y":0.08,"width":0.84,"height":0.25,"size":0.15],
            ["id":"count", "type":"number", "from":324,"to":553,"x":0.08,"y":0.4,"width":0.84,"height":0.5,"size":0.35],
        ], animations:[
            ["node":"a","property":"opacity","from":1,"to":0,"start":1.8,"end":2],
            ["node":"b","property":"opacity","from":0,"to":1,"start":2,"end":2.2],
            ["node":"count","property":"value","from":0,"to":1,"start":0.5,"end":2],
        ])
        #expect(SceneLayoutQuality.issues(scene: draft, size: CGSize(width:254,height:160)).isEmpty)
    }
    @Test func renderLiveProviderResultWhenOptedIn() throws {
        guard let directory = ProcessInfo.processInfo.environment["OVERLAY_EVAL_OUTPUT"] else { return }
        let folder = URL(fileURLWithPath: directory)
        let data = try Data(contentsOf: folder.appending(path:"scene.json"))
        let scene = try #require(SceneValidator.validate(json:data)).scene
        // The box the design was made for, when the run saved one; the old
        // wide default otherwise.
        var size = CGSize(width:254,height:160)
        if let boxData = try? Data(contentsOf: folder.appending(path:"box.json")),
           let box = try? JSONSerialization.jsonObject(with: boxData) as? [String: Double],
           let width = box["widthPx"], let height = box["heightPx"]
        {
            size = CGSize(width: width, height: height)
        }
        let issues = SceneLayoutQuality.issues(scene:scene,size:size)
        #expect(issues.isEmpty, "\(issues)")
        #expect(!scene.animations.isEmpty)
        for (i,time) in [0.4,1.2,2.8,5.0,7.2].enumerated() {
            let image = try #require(ScenePosterRenderer.render(scene:scene,size:size,palette:.house,assets:EmptySceneAssetResolver(),at:time))
            let png = try #require(NSBitmapImageRep(cgImage:image).representation(using:.png,properties:[:]))
            try png.write(to:folder.appending(path:"frame-\(i).png"))
        }
    }
}
