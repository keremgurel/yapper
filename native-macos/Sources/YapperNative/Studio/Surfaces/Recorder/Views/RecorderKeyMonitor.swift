import AppKit
import SwiftUI

/// The recorder's keys, the same as the web's: Space records, pauses and
/// resumes, Return finishes, G toggles guides, F focuses the frame, Escape
/// leaves focus. Keys typed into a text field are left alone.
struct RecorderKeyMonitor: ViewModifier {
    enum Key { case record, finish, guides, focus, escape }

    let enabled: Bool
    let handle: (Key) -> Bool

    @State private var monitor: Any?

    func body(content: Content) -> some View {
        content
            .onAppear { install() }
            .onDisappear { remove() }
            .onChange(of: enabled) { install() }
    }

    private func install() {
        remove()
        let enabled = enabled
        let handle = handle
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            guard enabled, let key = Self.key(for: event), !Self.isTyping(in: event.window) else { return event }
            return handle(key) ? nil : event
        }
    }

    private func remove() {
        if let monitor { NSEvent.removeMonitor(monitor) }
        monitor = nil
    }

    private static func key(for event: NSEvent) -> Key? {
        let modifiers = event.modifierFlags.intersection([.command, .control, .option])
        guard modifiers.isEmpty else { return nil }
        switch event.keyCode {
        case 49: return .record
        case 36, 76: return .finish
        case 53: return .escape
        default: break
        }
        switch event.charactersIgnoringModifiers?.lowercased() {
        case "g": return .guides
        case "f": return .focus
        default: return nil
        }
    }

    private static func isTyping(in window: NSWindow?) -> Bool {
        // Named for the common case: anything that should keep the key.
        // A sheet over the recorder owns the keyboard.
        guard let window, window.sheetParent == nil, window.attachedSheet == nil else { return true }
        guard let responder = window.firstResponder else { return false }
        return responder is NSText || responder is NSTextView
    }
}

extension View {
    func recorderKeys(enabled: Bool, handle: @escaping (RecorderKeyMonitor.Key) -> Bool) -> some View {
        modifier(RecorderKeyMonitor(enabled: enabled, handle: handle))
    }
}
