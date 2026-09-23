import Foundation
import Testing
@testable import YapperNative

struct DictionaryDecodingTests {
    private func decode<T: Decodable>(_ json: String, as type: T.Type) throws -> T {
        try StudioJSONClient.decoder.decode(T.self, from: Data(json.utf8))
    }

    @Test func listDecodesEntriesInOrder() throws {
        let json = """
        {"entries":[
          {"id":"5b8f0c2e-8a1d-4f0e-9c1b-2f6d3a9e7c11","term":"CELPIP","aliases":["Salpip","sell pip"]},
          {"id":"0d7e4a91-33c2-4b6f-8e5a-91c4f2b8d610","term":"Yapper","aliases":[]}
        ]}
        """
        let response = try decode(json, as: DictionaryListResponse.self)
        #expect(response.entries.count == 2)
        #expect(response.entries[0].term == "CELPIP")
        #expect(response.entries[0].aliases == ["Salpip", "sell pip"])
        #expect(response.entries[1].aliases.isEmpty)
    }

    @Test func emptyListDecodes() throws {
        let response = try decode(#"{"entries":[]}"#, as: DictionaryListResponse.self)
        #expect(response.entries.isEmpty)
    }

    @Test func singleEntryDecodesFromWrites() throws {
        let json = """
        {"entry":{"id":"5b8f0c2e-8a1d-4f0e-9c1b-2f6d3a9e7c11","term":"CELPIP","aliases":["Salpip"]}}
        """
        let response = try decode(json, as: DictionaryEntryResponse.self)
        #expect(response.entry.id == "5b8f0c2e-8a1d-4f0e-9c1b-2f6d3a9e7c11")
        #expect(response.entry.aliases == ["Salpip"])
    }

    @Test func inputIsCleanedBeforeSending() throws {
        let input = DictionaryEntryInput(term: "  CEL   PIP ", aliases: ["Salpip", "salpip!", "  "])
        #expect(input.term == "CEL PIP")
        #expect(input.aliases == ["Salpip"])
        let body = try JSONSerialization.jsonObject(with: StudioJSONClient.encoder.encode(input)) as? [String: Any]
        #expect(body?["term"] as? String == "CEL PIP")
    }

    @Test func routeErrorCodesReadAsSentences() {
        let full = StudioAPIError(status: 400, code: "dictionary_full", message: "x")
        #expect(DictionaryCopy.message(for: full).contains("full"))
        let duplicate = StudioAPIError(status: 409, code: "duplicate_term", message: "x")
        #expect(DictionaryCopy.message(for: duplicate).contains("already"))
    }
}
