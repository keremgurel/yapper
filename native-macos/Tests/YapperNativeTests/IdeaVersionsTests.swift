import Foundation
import Testing
@testable import YapperNative

struct IdeaVersionsTests {
    private let longScript = """
    ## Why logic fails
    People buy on feeling.
    [B-ROLL: Amex ad]

    ## Who Rory is
    He ran Ogilvy campaigns for years.
    """

    @Test func chaptersCountSpokenWordsOnly() {
        let chapters = IdeaCanvasChapters.chapters(in: longScript)
        #expect(chapters.map(\.title) == ["Why logic fails", "Who Rory is"])
        #expect(chapters.map(\.words) == [4, 6])
        #expect(IdeaCanvasChapters.spokenWordCount(longScript) == 10)
        #expect(IdeaCanvasChapters.runtime(words: 1350) == "about 9 min")
        #expect(IdeaCanvasChapters.readingTime(words: 1150) == "5 min read")
    }

    @Test func itemDecodesItsLeadAndVersions() throws {
        let json = """
        {"item":{"id":"i1","title":"Rory","status":"captured","hooks":[],"blocks":[],"originalNote":"",
         "leadFormat":"short","versions":[{"format":"long","title":"Use Rory","hooks":[{"text":"Use Rory"}],
         "blocks":[],"script":"## One\\nWords","writtenFrom":"short"}]}}
        """
        let item = try StudioJSONClient.decoder.decode(IdeaCanvasItemEnvelope.self, from: Data(json.utf8)).item
        #expect(item.leadFormat == .short)
        #expect(item.versions.first?.format == .long)
        #expect(item.versions.first?.hooks == ["Use Rory"])
        #expect(item.versions.first?.writtenFrom == .short)
    }

    @Test func olderRowsReadAsShortLeads() throws {
        let json = #"{"item":{"id":"i1","title":"","status":"captured","hooks":[],"blocks":[],"originalNote":""}}"#
        let item = try StudioJSONClient.decoder.decode(IdeaCanvasItemEnvelope.self, from: Data(json.utf8)).item
        #expect(item.leadFormat == .short)
        #expect(item.versions.isEmpty)
    }

    @Test func recorderReadsTheChosenVersion() throws {
        let json = """
        {"item":{"id":"i1","title":"Short title","hooks":[{"text":"A hook"}],"blocks":[],"script":"Short words",
         "leadFormat":"short","versions":[{"format":"long","title":"Long title","hooks":[],"blocks":[],"script":"## One\\nLong words"}]}}
        """
        let item = try JSONDecoder().decode(RecorderContentEnvelope.self, from: Data(json.utf8)).item
        #expect(item.showing(format: "long").script == "## One\nLong words")
        #expect(item.showing(format: "long").title == "Long title")
        #expect(item.showing(format: "short").script == "Short words")
        #expect(item.showing(format: "article").script == "Short words")
        #expect(item.showing(format: nil).script == "Short words")
    }

    @Test func teleprompterDropsNotesAndMarksChapters() {
        #expect(TeleprompterText.spoken(longScript) == "WHY LOGIC FAILS\nPeople buy on feeling.\n\nWHO RORY IS\nHe ran Ogilvy campaigns for years.")
    }

    @Test func listGroupsByLeadAndFiltersByAnyVersion() throws {
        let json = """
        [{"id":"a","leadFormat":"short","versionFormats":["long"]},
         {"id":"b","leadFormat":"long","versionFormats":[]},
         {"id":"c"}]
        """
        let rows = try JSONDecoder().decode([IdeaItem].self, from: Data(json.utf8))
        #expect(rows[0].versions == ["short", "long"])
        #expect(rows[2].versions == ["short"])
        let longs = IdeaGrouping.applyViewFilters(rows, ["formats": ["long"]]).map(\.id)
        #expect(longs == ["a", "b"])
    }
}
