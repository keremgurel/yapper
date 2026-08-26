import Testing
@testable import YapperNative

@MainActor
@Suite("Native editor to Poster handoff")
struct PosterHandoffCommandTests {
    @Test("Each finished export opens its exact Poster item")
    func eachExportIsANewNavigation() {
        let commands = StudioWebCommands()
        let before = commands.posterGeneration

        commands.openPoster(itemID: "item-one")
        #expect(commands.posterGeneration == before + 1)
        #expect(commands.posterItemID == "item-one")

        commands.openPoster(itemID: "item-two")
        #expect(commands.posterGeneration == before + 2)
        #expect(commands.posterItemID == "item-two")
    }
}
