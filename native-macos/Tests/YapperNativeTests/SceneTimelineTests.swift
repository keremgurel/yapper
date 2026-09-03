import Testing
import Foundation
@testable import YapperNative

struct SceneTimelineTests {
    @Test func realJSONPreservesZeroOneAndAnimations() throws {
        let data = Data(#"{"version":1,"duration":1,"background":{"fill":"brand.surface","opacity":0},"nodes":[{"id":"count","type":"number","x":0,"y":0,"width":1,"height":1,"from":0,"to":1,"opacity":0}],"animations":[{"node":"count","property":"value","from":0,"to":1,"start":0,"end":1},{"node":"count","property":"opacity","from":0,"to":1,"start":0,"end":1}]}"#.utf8)
        let result = try #require(SceneValidator.validate(json: data))
        #expect(result.scene.duration == 1)
        #expect(result.scene.background?.opacity == 0)
        #expect(result.scene.nodes.first?.opacity == 0)
        #expect(result.scene.nodes.first?.from == 0)
        #expect(result.scene.nodes.first?.to == 1)
        #expect(result.scene.animations.count == 2)
        let decodedAgain = try #require(SceneValidator.validate(json: result.scene.encoded()))
        #expect(decodedAgain.scene == result.scene)
        #expect(SceneValidator.validate(json: Data(#"{"duration":true,"nodes":[]}"#.utf8)) == nil)
    }
    @Test func holdsPreviousValueUntilNextSegmentStarts() {
        let node = SceneNode(id: "hero", kind: .rect, x: 0, y: 0, width: 1, height: 1)
        let scene = OverlayScene(duration: 5, nodes: [node], animations: [
            .init(node: "hero", property: .opacity, from: 0, to: 1, start: 0.5, end: 1),
            .init(node: "hero", property: .opacity, from: 0.2, to: 0, start: 3, end: 4),
        ])
        let timeline = SceneTimeline(scene: scene)
        #expect(timeline.value(.opacity, of: "hero", at: 0, resting: 1) == 0)
        #expect(timeline.value(.opacity, of: "hero", at: 2, resting: 1) == 1)
        #expect(timeline.value(.opacity, of: "hero", at: 3, resting: 1) == 0.2)
        #expect(timeline.value(.opacity, of: "hero", at: 5, resting: 1) == 0)
    }

    @Test func counterSamplingIsBoundedAndPreservesEndpoints() {
        let indices = SceneAnimationBaker.counterSampleIndices(count: 1801, maximumFaces: 64)
        #expect(indices.count == 64)
        #expect(indices.first == 0)
        #expect(indices.last == 1800)
        #expect(Set(indices).count == indices.count)
        #expect(SceneAnimationBaker.counterSampleIndices(count: 1, maximumFaces: 2) == [0])
    }
}
