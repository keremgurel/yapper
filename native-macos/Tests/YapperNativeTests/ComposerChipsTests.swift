import AppKit
import Testing
@testable import YapperNative

@MainActor
struct ComposerChipsTests {
    private let url = "https://www.instagram.com/p/DaDjrBqxfdH/"

    private func display(_ before: String, _ after: String) -> NSAttributedString {
        let result = NSMutableAttributedString(string: before)
        result.append(NSAttributedString(attachment: ComposerLinkAttachment(url: url, platform: .instagram, fontSize: 14, dark: true)))
        result.append(NSAttributedString(string: after))
        return result
    }

    @Test func recognizesPlatformsByHost() {
        #expect(LinkPlatform(url: url) == .instagram)
        #expect(LinkPlatform(url: "https://vm.tiktok.com/abc") == .tiktok)
        #expect(LinkPlatform(url: "https://youtu.be/xyz") == .youtube)
        #expect(LinkPlatform(url: "https://m.youtube.com/shorts/xyz") == .youtube)
        #expect(LinkPlatform(url: "https://notyoutube.com/x") == nil)
        #expect(LinkPlatform(url: "https://figma.com/file") == nil)
    }

    @Test func plainTextPutsTheURLBack() {
        #expect(ComposerChips.plain(from: display("see ", " later")) == "see \(url) later")
    }

    @Test func offsetsRoundTripAroundAChip() {
        let shown = display("see ", " later")
        let urlLength = (url as NSString).length
        // Before the chip, offsets agree.
        #expect(ComposerChips.plainOffset(2, in: shown) == 2)
        // Just after the chip, the plain offset skips the whole URL.
        #expect(ComposerChips.plainOffset(5, in: shown) == 4 + urlLength)
        #expect(ComposerChips.displayOffset(4 + urlLength, in: shown) == 5)
        // Inside the URL lands after the chip.
        #expect(ComposerChips.displayOffset(10, in: shown) == 5)
        #expect(ComposerChips.displayOffset(4, in: shown) == 4)
    }

    @Test func aLinkBeingTypedWaitsUntilTheCaretMovesOn() {
        let text = "idea \(url)"
        let end = (text as NSString).length
        #expect(ComposerChips.pending(in: text, caret: end, pasted: false).isEmpty)
        #expect(ComposerChips.pending(in: text, caret: end, pasted: true).count == 1)
        #expect(ComposerChips.pending(in: text + " ", caret: end + 1, pasted: false).count == 1)
        #expect(ComposerChips.pending(in: "https://example.com/a ", caret: 0, pasted: true).isEmpty)
    }
}
