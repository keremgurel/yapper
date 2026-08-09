import AppKit
import Testing
@testable import YapperNative

@MainActor
struct CursorRegionTests {
    /// Two regions overlap constantly: a trim handle sits over the clip it
    /// trims, and both are told the pointer moved. The one in front has to win,
    /// or the pointer flickers between the arrows and the hand.
    @Test func aLaterSiblingIsInFrontOfAnEarlierOne() {
        let root = NSView(frame: NSRect(x: 0, y: 0, width: 100, height: 100))
        let behind = NSView(frame: root.bounds)
        let inFront = NSView(frame: root.bounds)
        root.addSubview(behind)
        root.addSubview(inFront)

        #expect(CursorRegions.zPath(of: behind).lexicographicallyPrecedes(CursorRegions.zPath(of: inFront)))
    }

    @Test func aChildIsInFrontOfItsParent() {
        let parent = NSView(frame: NSRect(x: 0, y: 0, width: 100, height: 100))
        let child = NSView(frame: parent.bounds)
        parent.addSubview(child)

        #expect(CursorRegions.zPath(of: parent).lexicographicallyPrecedes(CursorRegions.zPath(of: child)))
    }

    @Test func depthIsComparedFromTheTopDown() {
        // An early branch stays behind a later one however deep it goes.
        let root = NSView(frame: NSRect(x: 0, y: 0, width: 100, height: 100))
        let earlyBranch = NSView(frame: root.bounds)
        let lateBranch = NSView(frame: root.bounds)
        root.addSubview(earlyBranch)
        root.addSubview(lateBranch)
        let deepInEarly = NSView(frame: root.bounds)
        earlyBranch.addSubview(deepInEarly)

        #expect(CursorRegions.zPath(of: deepInEarly).lexicographicallyPrecedes(CursorRegions.zPath(of: lateBranch)))
    }
}
