import AppKit
import SwiftUI
import Testing
@testable import YapperNative

@MainActor
@Suite(.serialized)
struct TextLayerContentEditorTests {
    @Test func insertingInMiddleKeepsCaretAndUpdatesProjectText() async throws {
        let fixture = Fixture()
        defer { fixture.window.close() }
        let editor = try await fixture.editor()
        editor.setSelectedRange(NSRange(location: 13, length: 0))
        for character in "day 3 " {
            let before = editor.selectedRange().location
            editor.insertText(String(character), replacementRange: editor.selectedRange())
            await fixture.settle()
            #expect(editor.selectedRange() == NSRange(location: before + 1, length: 0))
            #expect(fixture.model.text == editor.string)
        }
        #expect(editor.string == "ACL recovery day 3 ep.6")
    }

    @Test func replacingSelectionAndExternalEditsStayConnected() async throws {
        let fixture = Fixture()
        defer { fixture.window.close() }
        let editor = try await fixture.editor()
        editor.setSelectedRange(NSRange(location: 4, length: 8))
        editor.insertText("rehab 🦵\nday 3", replacementRange: editor.selectedRange())
        await fixture.settle()
        #expect(editor.string == "ACL rehab 🦵\nday 3 ep.6")
        #expect(editor.selectedRange().location == ("ACL rehab 🦵\nday 3" as NSString).length)
        #expect(fixture.model.text == editor.string)

        // Project history can replace the value while the field has focus.
        fixture.model.text = "ACL recovery ep.6"
        await fixture.settle()
        #expect(editor.string == fixture.model.text)
        fixture.model.text = "Restored hook"
        await fixture.settle()
        #expect(editor.string == "Restored hook")
    }

    @MainActor private final class Model: ObservableObject {
        @Published var text = "ACL recovery ep.6"
    }

    private struct Host: View {
        @ObservedObject var model: Model
        var body: some View {
            TextLayerContentEditor(text: model.text) { model.text = $0 }
                .frame(width: 400, height: 100)
        }
    }

    @MainActor private final class Fixture {
        let model = Model()
        let window: NSWindow

        init() {
            _ = NSApplication.shared
            window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 400, height: 100),
                              styleMask: [.borderless], backing: .buffered, defer: false)
            window.isReleasedWhenClosed = false
            window.contentView = NSHostingView(rootView: Host(model: model))
            window.contentView?.layoutSubtreeIfNeeded()
        }

        func editor() async throws -> NSTextView {
            await settle()
            let editor = try #require(findEditor(in: window.contentView!))
            window.makeFirstResponder(editor)
            return editor
        }

        func settle() async {
            try? await Task.sleep(for: .milliseconds(80))
            window.contentView?.layoutSubtreeIfNeeded()
        }

        private func findEditor(in view: NSView) -> NSTextView? {
            if let editor = view as? NSTextView { return editor }
            return view.subviews.lazy.compactMap { self.findEditor(in: $0) }.first
        }
    }
}
