import Foundation
import Testing
@testable import YapperNative

@MainActor
private final class SavedValues {
    var values: [Double] = []
    func commit(_ value: Double) async { values.append(value) }
}

/// An inspector slider saves once per gesture: on release for a drag, after a
/// pause for keyboard and VoiceOver changes, and at once for a typed number.
@MainActor
struct SliderCommitDraftTests {
    private func settle() async {
        for _ in 0..<40 {
            try? await Task.sleep(for: .milliseconds(10))
        }
    }

    @Test func keyboardChangesSaveOnceAfterTheyPause() async {
        let draft = SliderCommitDraft(settle: .milliseconds(60)), saved = SavedValues()
        for step in [0.31, 0.32, 0.33] { draft.change(to: step, commit: saved.commit) }
        #expect(draft.value == 0.33)
        #expect(saved.values.isEmpty)
        await settle()
        #expect(saved.values == [0.33])
        #expect(draft.value == nil)
    }

    @Test func aDragSavesOnlyOnRelease() async {
        let draft = SliderCommitDraft(settle: .milliseconds(60)), saved = SavedValues()
        draft.beginDrag()
        for step in [0.4, 0.5, 0.6] { draft.change(to: step, commit: saved.commit) }
        await settle()
        #expect(saved.values.isEmpty)
        #expect(draft.value == 0.6)
        draft.endDrag(commit: saved.commit)
        await settle()
        #expect(saved.values == [0.6])
    }

    @Test func aSliderThatGoesAwaySavesWhatItWasHolding() async {
        let draft = SliderCommitDraft(settle: .seconds(30)), saved = SavedValues()
        draft.change(to: 0.42, commit: saved.commit)
        draft.flush(commit: saved.commit)
        await settle()
        #expect(saved.values == [0.42])

        draft.beginDrag()
        draft.change(to: 0.8, commit: saved.commit)
        draft.flush(commit: saved.commit)
        await settle()
        #expect(saved.values == [0.42, 0.8])

        // Nothing unsaved, nothing to do.
        draft.flush(commit: saved.commit)
        await settle()
        #expect(saved.values == [0.42, 0.8])
    }

    @Test func aTypedNumberSavesAtOnceAndCancelsAPendingPause() async {
        let draft = SliderCommitDraft(settle: .milliseconds(60)), saved = SavedValues()
        draft.change(to: 0.2, commit: saved.commit)
        draft.type(0.75, commit: saved.commit)
        await settle()
        #expect(saved.values == [0.75])
    }
}
