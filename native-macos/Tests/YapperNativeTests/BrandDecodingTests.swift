import Foundation
import Testing
@testable import YapperNative

/// The brand routes' replies, and the hex rules the native editor applies
/// before it sends a palette.
@Suite
struct BrandDecodingTests {
    private func decode<T: Decodable>(_ json: String, as type: T.Type) throws -> T {
        try StudioJSONClient.decoder.decode(T.self, from: Data(json.utf8))
    }

    @Test func decodesKit() throws {
        let json = """
        {"colors":["#FF7A21","#151515"],"logos":[
        {"id":"a1","name":"wordmark.svg","mimeType":"image/svg+xml","mediaBytes":2048,"isPrimary":true,
         "url":"https://r2.example.com/u/wordmark.svg?X-Amz-Signature=abc"},
        {"id":"a2","name":"icon.png","mimeType":"image/png","mediaBytes":300,"isPrimary":false,
         "url":"https://r2.example.com/u/icon.png?X-Amz-Signature=def"}]}
        """
        let kit = try decode(json, as: BrandKit.self)
        #expect(kit.colors == ["#FF7A21", "#151515"])
        #expect(kit.logos.first?.isPrimary == true)
        #expect(kit.logos[0].sizeLabel == "2 KB")
        #expect(kit.logos[1].sizeLabel == "1 KB")
    }

    @Test func decodesEmptyKitLogoAndTicket() throws {
        let empty = try decode(#"{"colors":[],"logos":[]}"#, as: BrandKit.self)
        #expect(empty.colors.isEmpty && empty.logos.isEmpty)
        let logo = try decode(#"{"logo":{"id":"a3","name":"dark.webp","mimeType":"image/webp","mediaBytes":51200,"isPrimary":false,"url":"https://r2.example.com/x"}}"#, as: BrandLogoEnvelope.self)
        #expect(logo.logo.name == "dark.webp")
        let ticket = try decode(#"{"url":"https://r2.example.com/put?sig=1","key":"users/u1/media/abc.png"}"#, as: BrandUploadTicket.self)
        #expect(ticket.key.hasSuffix(".png"))
    }

    @Test func hexNormalization() {
        #expect(BrandHex.normalize("#ff7a21") == "#FF7A21")
        #expect(BrandHex.normalize("abc") == "#AABBCC")
        #expect(BrandHex.normalize(" #FFF ") == "#FFFFFF")
        #expect(BrandHex.normalize("#12345") == nil)
        #expect(BrandHex.normalize("orange") == nil)
        #expect(BrandHex.hex(BrandHex.color("#3B9DFF")) == "#3B9DFF")
    }

    @Test func nextSuggestionSkipsUsedColors() {
        #expect(BrandHex.next(after: []) == "#FF7A21")
        #expect(BrandHex.next(after: ["#FF7A21", "#151515"]) == "#FFFFFF")
        #expect(BrandHex.next(after: Array(repeating: "#000000", count: 8)) == nil)
    }

    @Test func logoMimeTypes() {
        #expect(BrandLogoUploader.mimeType(for: URL(fileURLWithPath: "/tmp/a.PNG")) == "image/png")
        #expect(BrandLogoUploader.mimeType(for: URL(fileURLWithPath: "/tmp/a.jpg")) == "image/jpeg")
        #expect(BrandLogoUploader.mimeType(for: URL(fileURLWithPath: "/tmp/a.svg")) == "image/svg+xml")
        #expect(BrandLogoUploader.mimeType(for: URL(fileURLWithPath: "/tmp/a.webp")) == "image/webp")
        #expect(BrandLogoUploader.mimeType(for: URL(fileURLWithPath: "/tmp/a.gif")) == nil)
    }

    @Test func mapsRouteErrorCodes() {
        let full = StudioAPIError(status: 402, code: "storage_full", message: "x")
        #expect(BrandErrorMessage.text(for: full).contains("storage is full"))
        let limit = StudioAPIError(status: 409, code: "logo_limit", message: "x")
        #expect(BrandErrorMessage.text(for: limit).contains("8 logos"))
    }
}
