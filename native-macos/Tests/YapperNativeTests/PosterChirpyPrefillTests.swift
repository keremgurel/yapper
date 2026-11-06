import Foundation
import Testing
@testable import YapperNative

@MainActor
@Suite("Chirpy's Poster fill-in")
struct PosterChirpyPrefillTests {
    @Test("A fill-in never wipes the creator's title, body or hashtags")
    func fillsFieldByField() {
        let current: PosterCaptionSet = [
            .youtube: PosterCaption(platform: "youtube", title: "My own title", body: "My description", hashtags: ["gym"]),
            .tiktok: PosterCaption(platform: "tiktok", title: "", body: "Old caption", hashtags: ["fitness"]),
        ]
        let filled = current.filling([
            PosterCaption(platform: "youtube", title: "", body: "New words", hashtags: []),
            PosterCaption(platform: "tiktok", title: "", body: "", hashtags: []),
            PosterCaption(platform: "instagram", title: "", body: "Reel caption", hashtags: []),
        ])
        #expect(filled[.youtube] == PosterCaption(platform: "youtube", title: "My own title", body: "New words", hashtags: []))
        #expect(filled[.tiktok] == current[.tiktok])
        #expect(filled[.instagram]?.body == "Reel caption")
    }

    @Test("A hand-over of another video drops a fill-in that never landed")
    func dropsStaleFillIn() throws {
        let handoff = PosterHandoff()
        let prefill = try #require(PosterPrefill(params: ["videoID": "gym", "title": "Gym myths", "platforms": ["tiktok"]]))
        handoff.prefill(prefill)
        #expect(handoff.take(generation: 1, itemID: "gym"))
        #expect(handoff.prefillVideoID == "gym")

        handoff.prefill(prefill)
        #expect(handoff.take(generation: 2, itemID: "desk"))
        #expect(handoff.prefillVideoID == nil)
    }

    @Test("Only the platforms Chirpy named are read")
    func readsNamedPlatformsOnly() throws {
        let named = try #require(PosterPrefill(params: ["videoID": "gym", "platforms": ["tiktok", "myspace"]]))
        #expect(named.platforms == [.tiktok])
        let unnamed = try #require(PosterPrefill(params: ["videoID": "gym", "captions": [["platform": "youtube", "body": "Hi"]]]))
        #expect(unnamed.platforms == nil)
        #expect(unnamed.captions.first?.title == "")
    }
}
