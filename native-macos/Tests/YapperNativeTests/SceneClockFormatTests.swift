import Foundation
import Testing
@testable import YapperNative

/// The `clock` number format: a countdown is one node, not a stack of digits.
struct SceneClockFormatTests {
    @Test func secondsReadAsMinutesAndSeconds() {
        #expect(SceneNumberFormatter.format(value: 300, format: .clock) == "5:00")
        #expect(SceneNumberFormatter.format(value: 299.4, format: .clock) == "4:59")
        #expect(SceneNumberFormatter.format(value: 59.5, format: .clock) == "1:00")
        #expect(SceneNumberFormatter.format(value: 9, format: .clock) == "0:09")
        #expect(SceneNumberFormatter.format(value: 4_500, format: .clock) == "75:00")
        #expect(SceneNumberFormatter.format(value: -0.3, format: .clock) == "0:00")
        #expect(SceneNumberFormatter.format(value: -61, format: .clock) == "-1:01")
        #expect(SceneNumberFormatter.format(value: 90, format: .clock, prefix: "T-") == "T-1:30")
    }

    @Test func aCountdownSurvivesValidationAndCountsDown() throws {
        let json = #"""
        {"version":1,"duration":6,"nodes":[{"id":"timer","type":"number","from":300,"to":0,"format":"clock",
        "size":0.4,"x":0.1,"y":0.2,"width":0.8,"height":0.5}],
        "animations":[{"node":"timer","property":"value","from":0,"to":1,"start":0,"end":6,"easing":"linear"}]}
        """#
        let result = try #require(SceneValidator.validate(json: Data(json.utf8)))
        let timer = try #require(result.scene.nodes.first)
        #expect(timer.format == .clock)
        #expect(SceneCounterFace.string(for: timer, progress: 0) == "5:00")
        #expect(SceneCounterFace.string(for: timer, progress: 0.5) == "2:30")
        #expect(SceneCounterFace.string(for: timer, progress: 1) == "0:00")
    }
}
