import AppKit
import SwiftUI
import Testing
@testable import YapperNative

@MainActor
struct ComposerTextViewTests {
    private let url = "https://www.instagram.com/p/DaDjrBqxfdH/"

    private func harness(_ start: String) -> (ComposerNSTextView, CaptureDraft, ComposerTextView.Coordinator) {
        let draft = CaptureDraft(defaults: UserDefaults(suiteName: "composer-tests-\(UUID())")!)
        draft.text = start
        draft.selection = NSRange(location: (start as NSString).length, length: 0)
        let view = ComposerTextView(draft: draft, fontSize: 14, editable: true, onSubmit: {}, onEscape: {}, contentHeight: .constant(0))
        let coordinator = view.makeCoordinator()
        let text = ComposerNSTextView(frame: NSRect(x: 0, y: 0, width: 400, height: 100))
        text.isRichText = false
        text.delegate = coordinator
        coordinator.textView = text
        coordinator.applyExternalText()
        return (text, draft, coordinator)
    }

    private func type(_ string: String, into text: NSTextView) {
        for character in string { text.insertText(String(character), replacementRange: text.selectedRange()) }
    }

    @Test func typingPastALinkChipsItAndDeletingWalksBack() {
        let (text, draft, _) = harness("he ol")
        type(" \(url) and", into: text)
        #expect(draft.text == "he ol \(url) and")
        #expect(text.string == "he ol \u{FFFC} and")
        for _ in 0..<6 { text.deleteBackward(nil) }
        #expect(text.string == "he ol")
        #expect(draft.text == "he ol")
    }

    @Test func pastingALinkChipsItAtOnce() {
        let (text, draft, _) = harness("idea ")
        text.insertText(url, replacementRange: text.selectedRange())
        #expect(text.string == "idea \u{FFFC}")
        #expect(draft.text == "idea \(url)")
    }
}
