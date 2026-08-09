import Foundation
import Testing

@testable import YapperNative

/// Picking rows in the media bin. The rules are the ones every list on this
/// machine already uses, so what these really pin down is that nothing here
/// invented its own.
struct MediaSelectionTests {
    private let order = (0 ..< 5).map { _ in UUID() }

    private func selection(_ picks: [(Int, MediaSelection.Modifier)]) -> MediaSelection {
        picks.reduce(MediaSelection.empty) { current, pick in
            current.clicking(order[pick.0], modifier: pick.1, in: order)
        }
    }

    @Test func aPlainClickReplacesEverything() {
        let picked = selection([(0, .none), (3, .none)])
        #expect(picked.ids == [order[3]])
        #expect(picked.count == 1)
    }

    @Test func commandAddsAndTakesBackOut() {
        var picked = selection([(0, .none), (2, .toggle), (4, .toggle)])
        #expect(picked.ids == Set([order[0], order[2], order[4]]))
        picked = picked.clicking(order[2], modifier: .toggle, in: order)
        #expect(picked.ids == Set([order[0], order[4]]))
    }

    @Test func shiftTakesTheRunBetween() {
        let picked = selection([(1, .none), (3, .extend)])
        #expect(picked.ids == Set(order[1 ... 3]))
    }

    @Test func shiftWorksBackwardsToo() {
        let picked = selection([(3, .none), (1, .extend)])
        #expect(picked.ids == Set(order[1 ... 3]))
    }

    /// The anchor stays put across a run of Shift-clicks, so dragging one back
    /// and forth grows and shrinks a single run instead of leaving a trail.
    @Test func aRunGrowsAndShrinksFromOneAnchor() {
        var picked = selection([(1, .none), (4, .extend)])
        #expect(picked.ids == Set(order[1 ... 4]))
        picked = picked.clicking(order[2], modifier: .extend, in: order)
        #expect(picked.ids == Set(order[1 ... 2]))
    }

    /// Command-clicking a row off cannot leave the anchor pointing at something
    /// that is no longer picked, or the next Shift-click measures from nowhere.
    @Test func theAnchorNeverPointsAtSomethingUnpicked() {
        var picked = selection([(0, .none), (2, .toggle)])
        picked = picked.clicking(order[2], modifier: .toggle, in: order)
        #expect(picked.anchor == order[0])
        #expect(picked.ids == [order[0]])
    }

    @Test func shiftWithNothingPickedYetJustPicksTheOne() {
        let picked = MediaSelection.empty.clicking(order[3], modifier: .extend, in: order)
        #expect(picked.ids.count >= 1)
        #expect(picked.contains(order[3]))
    }

    /// What a delete or an undo leaves behind: the picks that still exist.
    @Test func aDeletedRowDropsOutOfTheSelection() {
        let picked = selection([(0, .none), (1, .toggle), (4, .toggle)])
        let survivors = [order[0], order[4]]
        let reconciled = picked.reconciled(against: survivors)
        #expect(reconciled.ids == Set(survivors))
    }

    @Test func aDeletedAnchorIsForgotten() {
        let picked = selection([(2, .none), (3, .toggle)])
        let reconciled = picked.reconciled(against: [order[3]])
        #expect(reconciled.anchor == order[3])
        #expect(reconciled.ids == [order[3]])
    }

    @Test func selectingEverythingPicksEverything() {
        let picked = MediaSelection.empty.selecting(order)
        #expect(picked.count == order.count)
        #expect(picked.anchor == order.last)
    }
}

/// A Finder drag carries anything at all, including folders and text clippings.
struct MediaDropTests {
    private func url(_ name: String) -> URL {
        URL(fileURLWithPath: "/tmp/does-not-exist/\(name)")
    }

    /// Nothing on disk to read a type from, so this is the extension fallback,
    /// which is the path a file on an unindexed volume takes.
    @Test func videosAndImagesAreKept() {
        let kept = EditorSession.importableURLs([
            url("a.mp4"), url("b.MOV"), url("c.png"), url("d.jpeg"), url("e.heic"),
        ])
        #expect(kept.count == 5)
    }

    @Test func everythingElseIsDropped() {
        let kept = EditorSession.importableURLs([
            url("notes.txt"), url("deck.pdf"), url("song.mp3"), url("folder"),
        ])
        #expect(kept.isEmpty)
    }

    @Test func aMixedDragKeepsOnlyWhatItCanOpen() {
        let kept = EditorSession.importableURLs([url("notes.txt"), url("clip.mp4")])
        #expect(kept.map(\.lastPathComponent) == ["clip.mp4"])
    }
}
