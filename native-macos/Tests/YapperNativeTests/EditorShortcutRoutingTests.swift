import AppKit
import Testing
import WebKit
@testable import YapperNative

@MainActor
struct EditorShortcutRoutingTests {
    private final class KeyWindow: NSWindow {
        override var canBecomeKey: Bool { true }
    }
    private final class Scope: NSView, EditorKeyboardCommandScope {
        var editorKeyboardCommandsEnabled = true
    }
    private final class KeySink: NSView {
        var keys = 0
        override var acceptsFirstResponder: Bool { true }
        override func keyDown(with event: NSEvent) { keys += 1 }
    }
    private func event(_ window: NSWindow, key: UInt16 = 49, text: String = " ",
                       modifiers: NSEvent.ModifierFlags = [], repeatKey: Bool = false,
                       timestamp: Double) -> NSEvent {
        NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: modifiers,
                        timestamp: timestamp, windowNumber: window.windowNumber, context: nil,
                        characters: text, charactersIgnoringModifiers: text,
                        isARepeat: repeatKey, keyCode: key)!
    }
    private func window() -> (NSWindow, Scope, TimelineKeyCommandView.PassthroughView) {
        _ = NSApplication.shared
        let window = KeyWindow(contentRect: NSRect(x: 0, y: 0, width: 400, height: 300),
                              styleMask: [.borderless], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        let scope = Scope(frame: NSRect(x: 0, y: 0, width: 400, height: 300))
        window.contentView = scope
        let listener = TimelineKeyCommandView.PassthroughView(frame: .zero)
        scope.addSubview(listener)
        return (window, scope, listener)
    }

    @Test("active editor shortcuts do not depend on the invisible listener's drawing area")
    func clippedListener() {
        let (window, scope, listener) = window()
        defer { window.close() }
        var commands: [TimelineKeyCommand] = []
        let coordinator = TimelineKeyCommandView.Coordinator { commands.append($0) }
        coordinator.view = listener
        listener.clipsToBounds = true
        listener.frame = NSRect(x: -50_000, y: 0, width: 1, height: 1)
        #expect(listener.visibleRect.isEmpty)
        #expect(coordinator.handle(event(window, timestamp: 10_001)) == nil)
        #expect(coordinator.handle(event(window, key: 33, text: "[", timestamp: 10_002)) == nil)
        #expect(commands == [.togglePlayback, .trimLeading])
        scope.editorKeyboardCommandsEnabled = false
        #expect(coordinator.handle(event(window, timestamp: 10_003)) != nil)
        #expect(commands.count == 2)
    }

    @Test("consumed keys do not leak back to the focused control through the installed monitor")
    func monitorConsumes() {
        let (window, scope, listener) = window()
        defer { window.close() }
        let sink = KeySink(frame: scope.bounds)
        scope.addSubview(sink)
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(sink)
        #expect(window.firstResponder === sink)
        var calls = 0
        let coordinator = TimelineKeyCommandView.Coordinator { _ in calls += 1 }
        coordinator.view = listener
        coordinator.install()
        defer { coordinator.uninstall() }
        let press = event(window, timestamp: 20_001)
        NSApp.sendEvent(press)
        NSApp.sendEvent(press)
        NSApp.sendEvent(event(window, repeatKey: true, timestamp: 20_002))
        #expect(calls == 1)
        #expect(sink.keys == 0)
        NSApp.sendEvent(event(window, key: 7, text: "x", timestamp: 20_003))
        #expect(sink.keys == 1)
    }

    @Test("editing text, another window, and command shortcuts retain their keys")
    func respectsFocus() {
        let (window, scope, listener) = window()
        let (other, _, _) = self.window()
        defer { window.close(); other.close() }
        var calls = 0
        let coordinator = TimelineKeyCommandView.Coordinator { _ in calls += 1 }
        coordinator.view = listener
        let text = NSTextView(frame: scope.bounds)
        scope.addSubview(text)
        window.makeFirstResponder(text)
        #expect(coordinator.handle(event(window, timestamp: 30_001)) != nil)
        #expect(coordinator.handle(event(window, key: 33, text: "[", timestamp: 30_002)) != nil)
        window.makeFirstResponder(nil)
        #expect(coordinator.handle(event(other, timestamp: 30_003)) != nil)
        #expect(coordinator.handle(event(window, key: 33, text: "[", modifiers: [.command], timestamp: 30_004)) != nil)
        #expect(calls == 0)
    }

    @Test("brackets generated with Option or Shift work without stealing other modified keys")
    func keyboardLayouts() {
        let (window, _, _) = window()
        defer { window.close() }
        for modifiers: NSEvent.ModifierFlags in [[], [.option], [.shift], [.option, .shift]] {
            #expect(TimelineKeyCommandView.Coordinator.command(for: event(window, key: 25, text: "[", modifiers: modifiers, timestamp: 40_001)) == .trimLeading)
            #expect(TimelineKeyCommandView.Coordinator.command(for: event(window, key: 29, text: "]", modifiers: modifiers, timestamp: 40_002)) == .trimTrailing)
        }
        #expect(TimelineKeyCommandView.Coordinator.command(for: event(window, key: 1, text: "S", modifiers: [.shift], timestamp: 40_003)) == nil)
    }

    @Test("a parked authentication web view cannot disable native editor keys")
    func parkedWebFocus() {
        let (window, scope, _) = window()
        defer { window.close() }
        let web = WKWebView(frame: scope.bounds)
        scope.addSubview(web)
        #expect(TimelineKeyCommandView.Coordinator.isInsideWebView(web))
        web.frame.origin.x = -50_000
        #expect(!TimelineKeyCommandView.Coordinator.isInsideWebView(web))
    }
}
