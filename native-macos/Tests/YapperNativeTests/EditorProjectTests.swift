import Foundation
import Testing
@testable import YapperNative

struct EditorProjectTests {
    @Test func resettingOneMediaPreservesOtherMediaAndEveryLayer() {
        let firstID = UUID()
        let secondID = UUID()
        let text = ProjectTextLayer(text: "Keep me", timelineStart: 0, duration: 2)
        let overlay = ProjectOverlay(mediaID: secondID, timelineStart: 1, duration: 2)
        let audio = ProjectAudioLayer(
            url: URL(fileURLWithPath: "/tmp/keep.wav"),
            name: "Keep audio",
            timelineStart: 0,
            duration: 1
        )
        var project = EditorProject(
            clips: [
                TimelineClip(mediaID: firstID, sourceStart: 2, sourceEnd: 4),
                TimelineClip(mediaID: secondID, sourceStart: 0, sourceEnd: 3),
                TimelineClip(mediaID: firstID, sourceStart: 8, sourceEnd: 10),
            ],
            overlays: [overlay],
            textLayers: [text],
            audioLayers: [audio]
        )

        let replacement = project.resetMainTrack(mediaID: firstID, sourceDuration: 12)

        #expect(replacement != nil)
        #expect(project.clips.count == 2)
        #expect(project.clips[0] == replacement)
        #expect(project.clips[0].sourceStart == 0)
        #expect(project.clips[0].sourceEnd == 12)
        #expect(project.clips[1].mediaID == secondID)
        #expect(project.overlays == [overlay])
        #expect(project.textLayers == [text])
        #expect(project.audioLayers == [audio])
    }

    @Test func removingImportedMediaNeverDeletesUnrelatedProjectContent() {
        let removedID = UUID()
        let keptID = UUID()
        let removedMedia = ProjectMedia(
            id: removedID,
            url: URL(fileURLWithPath: "/tmp/removed.mov"),
            name: "Removed",
            duration: 4,
            width: 1080,
            height: 1920,
            hasAudio: true
        )
        let keptMedia = ProjectMedia(
            id: keptID,
            url: URL(fileURLWithPath: "/tmp/kept.mov"),
            name: "Kept",
            duration: 5,
            width: 1080,
            height: 1920,
            hasAudio: true
        )
        let keptText = ProjectTextLayer(text: "Still here", timelineStart: 0, duration: 1)
        var project = EditorProject(
            media: [removedMedia, keptMedia],
            clips: [
                TimelineClip(mediaID: removedID, sourceStart: 0, sourceEnd: 4),
                TimelineClip(mediaID: keptID, sourceStart: 0, sourceEnd: 5),
            ],
            transcript: [
                TranscriptWord(mediaID: removedID, text: "gone", start: 0, end: 0.2),
                TranscriptWord(mediaID: keptID, text: "kept", start: 0, end: 0.2),
            ],
            overlays: [
                ProjectOverlay(mediaID: removedID, timelineStart: 0, duration: 1),
                ProjectOverlay(mediaID: keptID, timelineStart: 1, duration: 1),
            ],
            textLayers: [keptText]
        )

        let didRemove = project.removeImportedMedia(removedID)
        #expect(didRemove)
        #expect(project.media == [keptMedia])
        #expect(project.clips.map(\.mediaID) == [keptID])
        #expect(project.transcript?.map(\.mediaID) == [keptID])
        #expect(project.overlays?.map(\.mediaID) == [keptID])
        #expect(project.textLayers == [keptText])
    }

    @Test func editorHistorySupportsUndoRedoAndClearsRedoAfterANewEdit() {
        let mediaID = UUID()
        let original = EditorProject(clips: [
            TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 10),
        ])
        var split = original
        let didSplit = split.split(clipID: split.clips[0].id, atTimelineTime: 4)
        #expect(didSplit)
        var deleted = split
        let didDelete = deleted.delete(clipID: deleted.clips[0].id)
        #expect(didDelete)

        var history = EditorHistory()
        history.record(before: original, after: split)
        history.record(before: split, after: deleted)

        #expect(history.canUndo)
        #expect(!history.canRedo)
        #expect(history.undo(current: deleted) == split)
        #expect(history.undo(current: split) == original)
        #expect(history.redo(current: original) == split)

        var replacement = split
        replacement.textLayers = [ProjectTextLayer(text: "New branch", timelineStart: 0, duration: 2)]
        history.record(before: split, after: replacement)
        #expect(!history.canRedo)
    }

    @Test func editorHistoryCoalescesDuplicateSnapshotsAndHonorsItsLimit() {
        let mediaID = UUID()
        let base = EditorProject(clips: [
            TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 10),
        ])
        var first = base
        first.name = "First"
        var second = first
        second.name = "Second"
        var third = second
        third.name = "Third"

        var history = EditorHistory(limit: 2)
        history.record(before: base, after: first)
        history.record(before: base, after: first)
        history.record(before: first, after: second)
        history.record(before: second, after: third)

        #expect(history.undo(current: third)?.name == "Second")
        #expect(history.undo(current: second)?.name == "First")
        #expect(history.undo(current: first) == nil)
    }

    @Test func transcriptionDownmixPreservesHeadroomWithoutStereoClipping() {
        #expect(TranscriptionPCM.monoSample(sum: 2, channelCount: 2) == 16_384)
        #expect(TranscriptionPCM.monoSample(sum: 0, channelCount: 2) == 0)
        #expect(TranscriptionPCM.monoSample(sum: 1, channelCount: 2) == 8_192)
        #expect(TranscriptionPCM.monoSample(sum: -1, channelCount: 2) == -8_192)
    }

    @Test func splitPreservesTotalDurationAndSourceContinuity() {
        let mediaID = UUID()
        let original = TimelineClip(
            mediaID: mediaID,
            sourceStart: 10,
            sourceEnd: 20
        )
        var project = EditorProject(clips: [original])

        let didSplit = project.split(clipID: original.id, atTimelineTime: 4)
        #expect(didSplit)
        #expect(project.clips.count == 2)
        #expect(project.duration == 10)
        #expect(project.clips[0].sourceStart == 10)
        #expect(project.clips[0].sourceEnd == 14)
        #expect(project.clips[1].sourceStart == 14)
        #expect(project.clips[1].sourceEnd == 20)
    }

    @Test func mapsEditedTimelineAcrossCuts() {
        let mediaID = UUID()
        let project = EditorProject(clips: [
            TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 2),
            TimelineClip(mediaID: mediaID, sourceStart: 8, sourceEnd: 12),
        ])

        #expect(project.clip(at: 1)?.sourceTime == 1)
        #expect(project.clip(at: 2.5)?.sourceTime == 8.5)
        #expect(project.duration == 6)
    }

    @Test func transcriptWordsMapToTheirExactEditedTimelinePosition() {
        let mediaID = UUID()
        let project = EditorProject(clips: [
            TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 2),
            TimelineClip(mediaID: mediaID, sourceStart: 8, sourceEnd: 12),
        ])
        let kept = TranscriptWord(mediaID: mediaID, text: "exact", start: 9, end: 9.4)
        let deleted = TranscriptWord(mediaID: mediaID, text: "removed", start: 5, end: 5.4)

        #expect(project.timelineTime(for: kept) == 3)
        #expect(project.timelineTime(for: deleted) == nil)
        #expect(project.nearestTimelineTime(for: deleted) == 2)
    }

    @Test func activeTranscriptWordFollowsEditedTimelineAcrossCuts() {
        let mediaID = UUID()
        let first = TranscriptWord(mediaID: mediaID, text: "first", start: 0.8, end: 1.2)
        let deleted = TranscriptWord(mediaID: mediaID, text: "deleted", start: 4, end: 4.4)
        let second = TranscriptWord(mediaID: mediaID, text: "second", start: 8.1, end: 8.5)
        let project = EditorProject(
            clips: [
                TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 2),
                TimelineClip(mediaID: mediaID, sourceStart: 8, sourceEnd: 12),
            ],
            transcript: [first, deleted, second]
        )

        #expect(project.transcriptWord(at: 1)?.id == first.id)
        #expect(project.transcriptWord(at: 2.3)?.id == second.id)
        #expect(project.transcriptWord(at: 4)?.id != deleted.id)
    }

    @Test func nativeCaptionsFollowTheEditedTimelineAndExcludeCutWords() {
        let mediaID = UUID()
        let words = [
            TranscriptWord(mediaID: mediaID, text: "This", start: 0.10, end: 0.30),
            TranscriptWord(mediaID: mediaID, text: "stays.", start: 0.38, end: 0.64),
            TranscriptWord(mediaID: mediaID, text: "deleted", start: 1.30, end: 1.65),
            TranscriptWord(mediaID: mediaID, text: "Still", start: 2.10, end: 2.32),
            TranscriptWord(mediaID: mediaID, text: "here", start: 2.40, end: 2.64),
        ]
        let project = EditorProject(
            media: [
                ProjectMedia(
                    id: mediaID,
                    url: URL(filePath: "/tmp/caption-test.mp4"),
                    name: "caption-test.mp4",
                    duration: 3,
                    width: 1080,
                    height: 1920,
                    hasAudio: true
                ),
            ],
            clips: [
                TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 1),
                TimelineClip(mediaID: mediaID, sourceStart: 2, sourceEnd: 3),
            ],
            transcript: words,
            captionsEnabled: true
        )

        #expect(project.captionCues.map(\.text) == ["This stays.", "Still here"])
        #expect(project.captionCues[1].timelineStart < 1.11)
        #expect(project.captionCues[1].timelineStart > 1.05)
        #expect(project.captionCue(at: 0.2)?.text == "This stays.")
        #expect(!project.captionCues.map(\.text).joined().contains("deleted"))
    }

    @Test func nativeCaptionsRemainOffUntilEnabled() {
        let mediaID = UUID()
        let project = EditorProject(
            clips: [TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 1)],
            transcript: [
                TranscriptWord(mediaID: mediaID, text: "Hidden", start: 0.1, end: 0.4),
            ]
        )

        #expect(project.captionCues.isEmpty)
    }

    @Test func transcriptSelectionMatchesWebRangeAndAdditiveGestures() {
        let ids = (0..<6).map { _ in UUID() }
        var selection = TranscriptWordSelection()

        selection.select(ids[1], orderedWordIDs: ids, extendingRange: false, toggling: false)
        #expect(selection.wordIDs == [ids[1]])
        #expect(selection.anchorID == ids[1])

        selection.select(ids[4], orderedWordIDs: ids, extendingRange: true, toggling: false)
        #expect(selection.wordIDs == Set(ids[1...4]))
        #expect(selection.anchorID == ids[1])

        selection.select(ids[0], orderedWordIDs: ids, extendingRange: false, toggling: true)
        #expect(selection.wordIDs == Set([ids[0], ids[1], ids[2], ids[3], ids[4]]))
        #expect(selection.anchorID == ids[0])

        selection.select(ids[2], orderedWordIDs: ids, extendingRange: false, toggling: true)
        #expect(!selection.wordIDs.contains(ids[2]))
        #expect(selection.anchorID == ids[2])

        selection.clear()
        #expect(selection.wordIDs.isEmpty)
        #expect(selection.anchorID == nil)
    }

    @Test func transcriptSelectionBuildsContiguousPaddedSourceRanges() {
        let firstMediaID = UUID()
        let secondMediaID = UUID()
        let words = [
            TranscriptWord(mediaID: firstMediaID, text: "one", start: 0.2, end: 0.5),
            TranscriptWord(mediaID: firstMediaID, text: "two", start: 0.6, end: 0.9),
            TranscriptWord(mediaID: firstMediaID, text: "three", start: 1.0, end: 1.3),
            TranscriptWord(mediaID: secondMediaID, text: "four", start: 0, end: 0.3),
        ]
        let selected = Set([words[0].id, words[1].id, words[3].id])

        let ranges = TranscriptWordSelection.sourceRanges(
            for: selected,
            in: words,
            padding: 0.025
        )

        #expect(ranges.count == 2)
        #expect(ranges[0].mediaID == firstMediaID)
        #expect(abs(ranges[0].start - 0.175) < 0.000_001)
        #expect(abs(ranges[0].end - 0.925) < 0.000_001)
        #expect(ranges[1].mediaID == secondMediaID)
        #expect(abs(ranges[1].start) < 0.000_001)
        #expect(abs(ranges[1].end - 0.325) < 0.000_001)
    }

    @Test func transcriptMarqueeSelectionReplacesAddsAndTogglesIntersectingWords() {
        let ids = (0..<4).map { _ in UUID() }
        let frames = [
            ids[0]: CGRect(x: 0, y: 0, width: 30, height: 20),
            ids[1]: CGRect(x: 36, y: 0, width: 30, height: 20),
            ids[2]: CGRect(x: 72, y: 0, width: 30, height: 20),
            ids[3]: CGRect(x: 0, y: 28, width: 30, height: 20),
        ]
        let box = CGRect(x: 34, y: -2, width: 72, height: 24)
        var selection = TranscriptWordSelection(wordIDs: [ids[0]], anchorID: ids[0])

        selection.selectMarquee(
            box,
            wordFrames: frames,
            orderedWordIDs: ids,
            baseWordIDs: [ids[0]],
            mode: .replace
        )
        #expect(selection.wordIDs == Set([ids[1], ids[2]]))
        #expect(selection.anchorID == ids[2])

        selection.selectMarquee(
            box,
            wordFrames: frames,
            orderedWordIDs: ids,
            baseWordIDs: [ids[0]],
            mode: .add
        )
        #expect(selection.wordIDs == Set([ids[0], ids[1], ids[2]]))

        selection.selectMarquee(
            box,
            wordFrames: frames,
            orderedWordIDs: ids,
            baseWordIDs: [ids[0], ids[1]],
            mode: .toggle
        )
        #expect(selection.wordIDs == Set([ids[0], ids[2]]))
        #expect(selection.anchorID == ids[2])
    }

    @Test func nonAdjacentTranscriptSelectionsRemainSeparateCuts() {
        let mediaID = UUID()
        let words = [
            TranscriptWord(mediaID: mediaID, text: "one", start: 0, end: 0.2),
            TranscriptWord(mediaID: mediaID, text: "two", start: 0.3, end: 0.5),
            TranscriptWord(mediaID: mediaID, text: "three", start: 0.6, end: 0.8),
        ]

        let ranges = TranscriptWordSelection.sourceRanges(
            for: Set([words[0].id, words[2].id]),
            in: words,
            padding: 0
        )

        #expect(ranges == [
            TranscriptSourceRange(mediaID: mediaID, start: 0, end: 0.2),
            TranscriptSourceRange(mediaID: mediaID, start: 0.6, end: 0.8),
        ])
    }

    @Test func deletedTranscriptAudioCanBeRestoredAndCoalescesCleanly() {
        let mediaID = UUID()
        var project = EditorProject(clips: [
            TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 1),
            TimelineClip(mediaID: mediaID, sourceStart: 2, sourceEnd: 4),
        ])
        let word = TranscriptWord(mediaID: mediaID, text: "restored", start: 1, end: 2)

        #expect(!project.isWordKept(word))
        project.restoreSourceRange((1, 2), for: mediaID)

        #expect(project.clips.count == 1)
        #expect(project.clips[0].sourceStart == 0)
        #expect(project.clips[0].sourceEnd == 4)
        #expect(project.isWordKept(word))
    }

    @Test func transcriptPauseStateTracksCutAndRestoredSourceRanges() {
        let mediaID = UUID()
        var project = EditorProject(clips: [
            TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 5),
        ])

        #expect(project.isSourceRangeKept(mediaID: mediaID, start: 1, end: 2))
        project.removeSourceRanges([(1, 2)], for: mediaID)
        #expect(!project.isSourceRangeKept(mediaID: mediaID, start: 1, end: 2))
        project.restoreSourceRange((1, 2), for: mediaID)
        #expect(project.isSourceRangeKept(mediaID: mediaID, start: 1, end: 2))
    }

    @Test func retakeRepairKeepsShortPhraseBeginningsWithoutCreatingDuplicateJoins() {
        let mediaID = UUID()
        func words(_ values: [String]) -> [TranscriptWord] {
            values.enumerated().map { index, text in
                TranscriptWord(
                    mediaID: mediaID,
                    text: text,
                    start: Double(index) * 0.24,
                    end: Double(index) * 0.24 + 0.2
                )
            }
        }

        let opening = words(["Three", "months", "ago,", "I", "started"])
        #expect(RetakeCutBoundaryRepair.repaired(words: opening, cuts: [(0, 0)]).isEmpty)

        let intro = words(["discarded", "and", "this", "week,", "I", "finally", "launched"])
        let repairedIntro = RetakeCutBoundaryRepair.repaired(words: intro, cuts: [(0, 4)])
        #expect(repairedIntro.count == 1)
        #expect(repairedIntro.first?.0 == 0)
        #expect(repairedIntro.first?.1 == 0)

        let pronoun = words(["discarded", "one", "of", "them.", "I've", "also", "continued"])
        let repairedPronoun = RetakeCutBoundaryRepair.repaired(words: pronoun, cuts: [(0, 4)])
        #expect(repairedPronoun.count == 1)
        #expect(repairedPronoun.first?.0 == 0)
        #expect(repairedPronoun.first?.1 == 3)

        let duplicate = words(["discarded", "and", "I", "I", "can", "continue"])
        let repairedDuplicate = RetakeCutBoundaryRepair.repaired(words: duplicate, cuts: [(0, 2)])
        #expect(repairedDuplicate.count == 1)
        #expect(repairedDuplicate.first?.0 == 0)
        #expect(repairedDuplicate.first?.1 == 2)

        let oneWordBoundaries = words([
            "kept", "tests,", "drill", "individual", "questions.",
            "discarded", "You", "have", "everything.",
            "discarded", "the", "you", "can",
        ])
        let repairedBoundaries = RetakeCutBoundaryRepair.repaired(
            words: oneWordBoundaries,
            cuts: [(2, 2), (5, 6), (9, 10)]
        )
        #expect(repairedBoundaries.count == 2)
        #expect(repairedBoundaries[0].0 == 5 && repairedBoundaries[0].1 == 5)
        #expect(repairedBoundaries[1].0 == 9 && repairedBoundaries[1].1 == 10)
    }

    @Test func retakeRepairGivesTheFinalTakeBackTheWordItOpenedWith() {
        let mediaID = UUID()
        func words(_ values: [String]) -> [TranscriptWord] {
            values.enumerated().map { index, text in
                TranscriptWord(
                    mediaID: mediaID,
                    text: text,
                    start: Double(index) * 0.26,
                    end: Double(index) * 0.26 + 0.22
                )
            }
        }

        // The matcher landed one word into the last attempt, leaving the "Stop"
        // the speaker said on the cut side. Every earlier attempt opens the same
        // way, so it belongs to the take.
        let retakes = words([
            "Stop", "trying", "to", "memorize", "full", "CELPIP", "speaking", "answers.",
            "Stop", "trying", "to", "memorize", "full", "CELPIP", "speaking", "answers",
            "and", "try", "these", "templates", "instead.",
        ])
        let repaired = RetakeCutBoundaryRepair.repaired(words: retakes, cuts: [(0, 8)])
        #expect(repaired.count == 1)
        #expect(repaired[0].0 == 0)
        #expect(repaired[0].1 == 7)

        // Only a whole repeated phrase counts. A single shared word before an
        // unrelated take is the boundary being right.
        let unrelated = words([
            "Stop", "trying", "to", "memorize", "full", "CELPIP", "speaking", "answers.",
            "Stop", "and", "think", "about", "what", "the", "examiner", "wants.",
        ])
        let leftAlone = RetakeCutBoundaryRepair.repaired(words: unrelated, cuts: [(0, 8)])
        #expect(leftAlone.count == 1)
        #expect(leftAlone[0].1 == 8)
    }

    @Test func retakeRepairReplacesDetachedFinalWordWithCompleteMatchingTake() {
        let mediaID = UUID()
        let values = [
            "Keep", "this", "main", "sentence.",
            "Follow", "for", "more", "CELPIP", "practice.",
            "practice.",
        ]
        let words = values.enumerated().map { index, text in
            let start = index == values.count - 1 ? 8.0 : Double(index) * 0.28
            return TranscriptWord(
                mediaID: mediaID,
                text: text,
                start: start,
                end: start + 0.22
            )
        }

        let repaired = RetakeCutBoundaryRepair.repaired(words: words, cuts: [(4, 8)])
        #expect(repaired.count == 1)
        #expect(repaired.first?.0 == 9)
        #expect(repaired.first?.1 == 9)
    }

    @Test func activeTimelineTranscriptExcludesWordsFromMediaLeftOnlyInTheBin() {
        let oldMediaID = UUID()
        let activeMediaID = UUID()
        let project = EditorProject(
            clips: [TimelineClip(mediaID: activeMediaID, sourceStart: 0, sourceEnd: 2)],
            transcript: [
                TranscriptWord(mediaID: oldMediaID, text: "old", start: 0, end: 0.2),
                TranscriptWord(mediaID: activeMediaID, text: "new", start: 0, end: 0.2),
            ]
        )

        #expect(project.timelineTranscript.map(\.text) == ["new"])
    }

    @Test func deletingAClipCollapsesTheTimeline() {
        let mediaID = UUID()
        let first = TimelineClip(mediaID: mediaID, sourceStart: 0, sourceEnd: 2)
        let second = TimelineClip(mediaID: mediaID, sourceStart: 4, sourceEnd: 8)
        var project = EditorProject(clips: [first, second])

        let didDelete = project.delete(clipID: first.id)
        #expect(didDelete)
        #expect(project.duration == 4)
        #expect(project.clips == [second])
    }

    @Test func draggingBaseClipUpPromotesItToAFullFrameOverlay() {
        let mediaID = UUID()
        let first = TimelineClip(mediaID: mediaID, sourceStart: 10, sourceEnd: 13)
        let second = TimelineClip(mediaID: mediaID, sourceStart: 20, sourceEnd: 25)
        var project = EditorProject(clips: [first, second])

        let overlay = project.promoteClipToOverlay(first.id)

        #expect(project.clips == [second])
        #expect(overlay?.timelineStart == 0)
        #expect(overlay?.sourceStart == 10)
        #expect(overlay?.duration == 3)
        #expect(overlay?.width == 1)
        #expect(overlay?.height == 1)
        #expect(project.overlays == [overlay!])
    }

    @Test func textLayersRoundTripAndRespectTheirTimelineWindow() throws {
        let layer = ProjectTextLayer(
            text: "A precise hook",
            timelineStart: 1.25,
            duration: 3.5,
            x: 0.4,
            y: 0.2,
            width: 0.72,
            appearance: TextAppearance(
                font: .editorial,
                fontScale: 0.065,
                color: .white,
                backgroundEnabled: true,
                backgroundColor: StudioColor.black.withOpacity(0.86)
            )
        )
        let project = EditorProject(textLayers: [layer])

        let encoded = try JSONEncoder().encode(project)
        let restored = try JSONDecoder().decode(EditorProject.self, from: encoded)

        #expect(restored.textLayers == [layer])
        #expect(!layer.isVisible(at: 1.24))
        #expect(layer.isVisible(at: 1.25))
        #expect(layer.isVisible(at: 4.75))
        #expect(!layer.isVisible(at: 4.76))
    }

    @MainActor
    @Test func selectingTextRequestsItsInspector() {
        let session = EditorSession()
        let layerID = UUID()

        session.selectTextLayer(layerID)

        #expect(session.selectedTextLayerID == layerID)
        #expect(session.inspectorRequest?.tool == "Text")
    }

    /// The library ships as real recordings now, so the thing worth checking is
    /// that every one of them is actually in the build and says what it is.
    @Test func everySoundEffectShipsWithTheApp() async throws {
        let library = SoundEffectDescriptor.library
        #expect(!library.isEmpty)
        #expect(Set(library.map(\.id)).count == library.count, "ids must be unique")
        #expect(Set(library.map(\.name)).count == library.count, "names must be unique")

        for effect in library {
            let url = try #require(
                SoundEffectService.shared.bundledURL(for: effect),
                "\(effect.id) is missing from the bundle"
            )
            let measured = try await SoundEffectService.shared.duration(of: url)
            // The stated duration is what the timeline lays out before the file
            // is read, so a wrong one puts the clip in the wrong place.
            #expect(
                abs(measured - effect.duration) < 0.12,
                "\(effect.id) is \(measured)s, listed as \(effect.duration)s"
            )
        }
    }

    /// Every shelf a creator can open has something on it.
    @Test func everyCategoryHasEffects() {
        for category in SoundEffectCategory.allCases {
            #expect(
                !SoundEffectDescriptor.library(in: category).isEmpty,
                "\(category.title) is empty"
            )
        }
        #expect(
            SoundEffectDescriptor.library
                .allSatisfy { SoundEffectCategory.allCases.contains($0.category) }
        )
    }

    @Test func audioLayersRoundTripWithTheProject() throws {
        let layer = ProjectAudioLayer(
            url: URL(filePath: "/tmp/pop.wav"),
            name: "Pop",
            timelineStart: 1.2,
            duration: 0.22,
            volume: 0.75,
            builtInID: "pop"
        )
        let project = EditorProject(audioLayers: [layer])
        let data = try JSONEncoder().encode(project)
        let restored = try JSONDecoder().decode(EditorProject.self, from: data)
        #expect(restored.audioLayers == [layer])
    }

    @Test func canvasMoveSnapsTextToBothCenterGuides() {
        let layer = ProjectTextLayer(text: "Centered", timelineStart: 0)
        let result = TextCanvasGeometry.moved(
            layer: layer,
            origin: CGPoint(x: 0.3, y: 0.3),
            translation: CGSize(width: 197, height: 97),
            canvasSize: CGSize(width: 1_000, height: 500)
        )
        #expect(result.layer.x == 0.5)
        #expect(result.layer.y == 0.5)
        #expect(result.guides.verticalCenter)
        #expect(result.guides.horizontalCenter)
    }

    @Test func cornerResizeChangesWidthAndFontScaleTogether() {
        let layer = ProjectTextLayer(
            text: "Resizable",
            timelineStart: 0,
            x: 0.5,
            y: 0.5,
            width: 0.5,
            appearance: TextAppearance(fontScale: 0.05)
        )
        let enlarged = TextCanvasGeometry.resized(
            layer: layer,
            translation: CGSize(width: 120, height: 80),
            corner: .bottomTrailing,
            canvasSize: CGSize(width: 1_000, height: 600)
        )
        #expect(enlarged.width > layer.width)
        #expect(enlarged.fontScale > layer.fontScale)
        #expect(enlarged.x > layer.x)
        #expect(enlarged.y > layer.y)
    }

    @Test func timelineTextEdgesTrimAndExtendDuration() {
        let layer = ProjectTextLayer(text: "Hook", timelineStart: 2, duration: 4)
        let extended = TimelineTextGeometry.trimmed(
            layer: layer,
            edge: .trailing,
            translationX: 100,
            contentWidth: 1_000,
            projectDuration: 10
        )
        #expect(extended.timelineStart == 2)
        #expect(extended.duration == 5)

        let earlier = TimelineTextGeometry.trimmed(
            layer: layer,
            edge: .leading,
            translationX: -100,
            contentWidth: 1_000,
            projectDuration: 10
        )
        #expect(earlier.timelineStart == 1)
        #expect(earlier.duration == 5)
    }

    @Test func timelineTextBodyTracksPointerExactlyAndClampsToTheProject() {
        let layer = ProjectTextLayer(text: "Move me", timelineStart: 2, duration: 3)
        let moved = TimelineTextGeometry.moved(
            layer: layer,
            translationX: 150,
            contentWidth: 1_000,
            projectDuration: 10
        )
        #expect(moved.timelineStart == 3.5)
        #expect(moved.duration == layer.duration)

        let clamped = TimelineTextGeometry.moved(
            layer: layer,
            translationX: 2_000,
            contentWidth: 1_000,
            projectDuration: 10
        )
        #expect(clamped.timelineStart == 7)
    }

    @Test func timelineVideoEdgesTrimAndRecoverSourceFrames() {
        let clip = TimelineClip(mediaID: UUID(), sourceStart: 5, sourceEnd: 10)
        let extended = TimelineClipGeometry.trimmed(
            clip: clip,
            edge: .leading,
            translationX: -100,
            contentWidth: 1_000,
            projectDuration: 10,
            mediaDuration: 30
        )
        #expect(extended.sourceStart == 4)
        #expect(extended.sourceEnd == 10)

        let trimmed = TimelineClipGeometry.trimmed(
            clip: clip,
            edge: .trailing,
            translationX: -100,
            contentWidth: 1_000,
            projectDuration: 10,
            mediaDuration: 30
        )
        #expect(trimmed.sourceStart == 5)
        #expect(trimmed.sourceEnd == 9)
    }

    @Test func timelineOverlayAndAudioUseTheSameEdgeBehavior() {
        let overlay = ProjectOverlay(
            mediaID: UUID(),
            timelineStart: 2,
            duration: 3
        )
        let overlayExtended = TimelineOverlayGeometry.trimmed(
            overlay: overlay,
            edge: .trailing,
            translationX: 100,
            contentWidth: 1_000,
            projectDuration: 10
        )
        #expect(overlayExtended.duration == 4)

        let audio = ProjectAudioLayer(
            url: URL(filePath: "/tmp/audio.wav"),
            name: "Audio",
            timelineStart: 2,
            duration: 3,
            sourceStart: 2,
            sourceDuration: 10
        )
        let audioExtended = TimelineAudioGeometry.trimmed(
            layer: audio,
            edge: .leading,
            translationX: -100,
            contentWidth: 1_000,
            projectDuration: 10
        )
        #expect(audioExtended.timelineStart == 1)
        #expect(audioExtended.sourceStart == 1)
        #expect(audioExtended.duration == 4)
    }

    @Test func timelineZoomClampsAndKeepsThePointerAnchored() {
        #expect(TimelineZoomGeometry.scaled(36, by: 2) == 72)
        #expect(TimelineZoomGeometry.scaled(230, by: 2) == 320)
        #expect(TimelineZoomGeometry.scaled(5, by: 0.2) == 1.25)

        let offset = TimelineZoomGeometry.anchoredOffset(
            oldOffset: 400,
            pointerX: 200,
            oldContentWidth: 1_200,
            newContentWidth: 2_400,
            viewportWidth: 600
        )
        #expect(offset == 1_000)
        // The same 50% timeline position remains under x=200 after zooming.
        #expect((offset + 200) / 2_400 == 0.5)

        let insetOffset = TimelineZoomGeometry.anchoredOffset(
            oldOffset: 484,
            pointerX: 200,
            oldContentWidth: 1_200,
            newContentWidth: 2_400,
            viewportWidth: 600,
            leadingInset: 84,
            trailingInset: 160
        )
        #expect(insetOffset == 1_084)
        #expect((insetOffset + 200 - 84) / 2_400 == 0.5)
    }

    @Test func repeatedTimelineZoomNeverDriftsFromThePointer() {
        let leadingInset = 84.0
        let trailingInset = 160.0
        let viewportWidth = 920.0
        let pointerX = 613.0
        var timelineWidth = 4_800.0
        var scrollOffset = 1_347.0
        let anchoredFraction = (scrollOffset + pointerX - leadingInset) / timelineWidth

        for factor in [1.08, 1.06, 0.93, 1.11, 0.89, 1.04, 0.96, 1.09] {
            let nextWidth = timelineWidth * factor
            scrollOffset = TimelineZoomGeometry.anchoredOffset(
                oldOffset: scrollOffset,
                pointerX: pointerX,
                oldContentWidth: timelineWidth,
                newContentWidth: nextWidth,
                viewportWidth: viewportWidth,
                leadingInset: leadingInset,
                trailingInset: trailingInset
            )
            timelineWidth = nextWidth
            let fractionUnderPointer = (scrollOffset + pointerX - leadingInset) / timelineWidth
            #expect(abs(fractionUnderPointer - anchoredFraction) < 0.000_000_001)
        }
    }

    @Test func timelineCommandScrollUsesAStableBoundedCurve() {
        #expect(TimelineZoomGeometry.scrollFactor(delta: 0, hasPreciseDeltas: true) == 1)
        #expect(TimelineZoomGeometry.scrollFactor(delta: 10, hasPreciseDeltas: true) > 1)
        #expect(TimelineZoomGeometry.scrollFactor(delta: -10, hasPreciseDeltas: true) < 1)
        #expect(TimelineZoomGeometry.scrollFactor(delta: 10_000, hasPreciseDeltas: true) == 2)
        #expect(TimelineZoomGeometry.scrollFactor(delta: -10_000, hasPreciseDeltas: true) == 0.5)
        // A line-based wheel notch has to move the zoom as far as a comparable
        // trackpad swipe, otherwise a mouse can barely zoom at all.
        #expect(
            TimelineZoomGeometry.scrollFactor(delta: 1, hasPreciseDeltas: false)
                > TimelineZoomGeometry.scrollFactor(delta: 1, hasPreciseDeltas: true)
        )
    }

    @Test func timelineZoomIsExactlySplittableAcrossEvents() {
        // One physical gesture arrives as many events. Ten small steps must land
        // on the same scale as the single large step covering the same distance.
        let stepped = (0 ..< 10).reduce(8.0) { scale, _ in
            TimelineZoomGeometry.scaled(
                scale,
                by: TimelineZoomGeometry.scrollFactor(delta: 6, hasPreciseDeltas: true)
            )
        }
        let single = TimelineZoomGeometry.scaled(
            8,
            by: TimelineZoomGeometry.scrollFactor(delta: 60, hasPreciseDeltas: true)
        )
        #expect(abs(stepped - single) < 0.000_000_1)
    }

    @Test func timelineZoomAnchorsAPointerParkedInTheLeadingInset() {
        // A pointer over the inset resolves to a negative fraction. Clamping it
        // used to pin the anchor to the first frame and let the clips slide.
        let leadingInset = 84.0
        let offset = TimelineZoomGeometry.anchoredOffset(
            oldOffset: 200,
            pointerX: 20,
            oldContentWidth: 1_200,
            newContentWidth: 2_400,
            viewportWidth: 600,
            leadingInset: leadingInset,
            trailingInset: 160
        )
        let before = (200 + 20 - leadingInset) / 1_200
        let after = (offset + 20 - leadingInset) / 2_400
        #expect(abs(after - before) < 0.000_000_001)
    }

    @MainActor
    @Test func timelineViewportKeepsThePointerPinnedAcrossAWholeZoomGesture() {
        let layout = TimelineViewportLayout(
            duration: 600,
            viewportWidth: 900,
            minimumContentWidth: 468,
            leadingInset: 84,
            trailingInset: 160
        )
        let viewport = TimelineViewportState()
        viewport.pan(by: 5_000, layout: layout)
        #expect(viewport.scrollX == 5_000)

        let anchorX = 400.0
        func fractionUnderPointer() -> Double {
            (viewport.scrollX + anchorX - layout.leadingInset)
                / layout.contentWidth(at: viewport.pointsPerSecond)
        }
        let anchored = fractionUnderPointer()

        // A real gesture is dozens of events in both directions; the anchor must
        // survive every one of them, not just a single clean zoom step.
        for step in 0 ..< 24 {
            viewport.zoom(
                by: step.isMultiple(of: 3) ? 0.94 : 1.07,
                anchorX: anchorX,
                layout: layout
            )
            #expect(abs(fractionUnderPointer() - anchored) < 0.000_000_001)
        }
        // The gesture really did move the zoom, so the check above is not
        // passing on a no-op.
        #expect(viewport.pointsPerSecond > 60)
    }

    @MainActor
    @Test func timelineViewportHoldsStillWhenZoomIsAlreadyAtItsLimit() {
        let layout = TimelineViewportLayout(
            duration: 60,
            viewportWidth: 900,
            minimumContentWidth: 468,
            leadingInset: 84,
            trailingInset: 160
        )
        let viewport = TimelineViewportState(pointsPerSecond: TimelineZoomGeometry.scaleRange.upperBound)
        viewport.pan(by: 1_000, layout: layout)
        let offsetAtLimit = viewport.scrollX
        viewport.zoom(by: 1.2, anchorX: 400, layout: layout)
        #expect(viewport.pointsPerSecond == TimelineZoomGeometry.scaleRange.upperBound)
        #expect(viewport.scrollX == offsetAtLimit)
    }

    @Test func timelinePinchAmplifiesButStillComposesAcrossUpdates() {
        // A pinch has to move the zoom further than the raw trackpad scale.
        #expect(TimelineZoomGeometry.pinchFactor(ratio: 1.1) > 1.1)
        #expect(TimelineZoomGeometry.pinchFactor(ratio: 0.9) < 0.9)
        #expect(TimelineZoomGeometry.pinchFactor(ratio: 1) == 1)
        #expect(TimelineZoomGeometry.pinchFactor(ratio: 0) == 1)

        // One pinch arrives as many updates, so amplifying each one must land
        // on the same scale as amplifying the gesture's total once.
        let perUpdate = (0 ..< 8).reduce(1.0) { total, _ in
            total * TimelineZoomGeometry.pinchFactor(ratio: 1.03)
        }
        let asOneStep = TimelineZoomGeometry.pinchFactor(ratio: pow(1.03, 8))
        #expect(abs(perUpdate - asOneStep) < 0.000_000_1)
    }

    @Test func timelineViewportLayoutFloorsShortProjectsAndBoundsScrolling() {
        let layout = TimelineViewportLayout(
            duration: 10,
            viewportWidth: 900,
            minimumContentWidth: 400,
            leadingInset: 84,
            trailingInset: 160
        )
        #expect(layout.contentWidth(at: 5) == 400)
        #expect(layout.contentWidth(at: 100) == 1_000)
        #expect(layout.maximumScrollX(contentWidth: 400) == 0)
        #expect(layout.maximumScrollX(contentWidth: 1_000) == 344)
        #expect(layout.clampedScrollX(-50, contentWidth: 1_000) == 0)
        #expect(layout.clampedScrollX(9_999, contentWidth: 1_000) == 344)
    }

    @Test func timelineScrollBarThumbRoundTripsThroughTheScrollOffset() {
        let layout = TimelineViewportLayout(
            duration: 120,
            viewportWidth: 900,
            minimumContentWidth: 400,
            leadingInset: 84,
            trailingInset: 160
        )
        let contentWidth = layout.contentWidth(at: 36)
        let maximumScrollX = layout.maximumScrollX(contentWidth: contentWidth)
        #expect(maximumScrollX > 0)
        for scrollX in [0.0, maximumScrollX / 3, maximumScrollX] {
            let thumbX = TimelineScrollBarGeometry.thumbX(
                scrollX: scrollX,
                layout: layout,
                contentWidth: contentWidth
            )
            let restored = TimelineScrollBarGeometry.scrollX(
                thumbX: thumbX,
                layout: layout,
                contentWidth: contentWidth
            )
            #expect(abs(restored - scrollX) < 0.000_000_1)
        }
    }

    @Test func projectAspectRatioControlsExportFrame() {
        #expect(
            CompositionBuilder.renderSize(
                sourceWidth: 1_728,
                sourceHeight: 3_072,
                aspectRatio: .source
            ) == CGSize(width: 1_728, height: 3_072)
        )
        #expect(
            CompositionBuilder.renderSize(
                sourceWidth: 1_920,
                sourceHeight: 1_080,
                aspectRatio: .portrait
            ) == CGSize(width: 1_080, height: 1_920)
        )
        #expect(
            CompositionBuilder.renderSize(
                sourceWidth: 1_728,
                sourceHeight: 3_072,
                aspectRatio: .landscape
            ) == CGSize(width: 3_072, height: 1_728)
        )
    }

    @Test func waveformFillsEveryVisibleColumnEvenWhenZoomExceedsPeakDensity() {
        let samples = 0 ..< 72
        let columns = 240
        let ranges = (0 ..< columns).map {
            TimelineWaveformGeometry.sampleRange(
                column: $0,
                columnCount: columns,
                samples: samples
            )
        }

        #expect(ranges.allSatisfy { !$0.isEmpty })
        #expect(ranges.first?.lowerBound == samples.lowerBound)
        #expect(ranges.last?.upperBound == samples.upperBound)
    }

    @Test func progressiveWaveformOccupiesOnlyTheDecodedPartOfAClip() {
        let complete = TimelineWaveformGeometry.window(
            peakCount: 9_600,
            progress: 1,
            sourceStart: 10,
            sourceEnd: 20,
            mediaDuration: 100
        )
        #expect(complete.fraction == 1)
        #expect(complete.range == 960 ..< 1_920)

        let partial = TimelineWaveformGeometry.window(
            peakCount: 1_440,
            progress: 0.15,
            sourceStart: 10,
            sourceEnd: 20,
            mediaDuration: 100
        )
        #expect(abs(partial.fraction - 0.5) < 0.001)
        #expect(partial.range == 960 ..< 1_440)
    }

    @Test func everyTrimEdgeTracksThePointerExactlyAtEveryZoomLevel() {
        let projectDuration = 40.0
        let pointerDeltas: [CGFloat] = [-137.25, -23.5, 18.75, 164.125]
        let contentWidths = [720.0, 2_400.0, 9_600.0]

        for contentWidth in contentWidths {
            for pointerDelta in pointerDeltas {
                let timeDelta = TimelineTrimGeometry.timeDelta(
                    for: pointerDelta,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                let renderedDelta = TimelineTrimGeometry.x(
                    for: timeDelta,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                #expect(abs(renderedDelta - pointerDelta) < 0.000_001)

                let clip = TimelineClip(mediaID: UUID(), sourceStart: 10, sourceEnd: 20)
                let leadingClip = TimelineClipGeometry.trimmed(
                    clip: clip,
                    edge: .leading,
                    translationX: pointerDelta,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration,
                    mediaDuration: 60
                )
                let leadingClipPixels = TimelineTrimGeometry.x(
                    for: leadingClip.sourceStart - clip.sourceStart,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                #expect(abs(leadingClipPixels - pointerDelta) < 0.000_001)

                let overlay = ProjectOverlay(
                    mediaID: UUID(),
                    timelineStart: 12,
                    duration: 10
                )
                let leadingOverlay = TimelineOverlayGeometry.trimmed(
                    overlay: overlay,
                    edge: .leading,
                    translationX: pointerDelta,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                let leadingOverlayPixels = TimelineTrimGeometry.x(
                    for: leadingOverlay.timelineStart - overlay.timelineStart,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                #expect(abs(leadingOverlayPixels - pointerDelta) < 0.000_001)

                let text = ProjectTextLayer(
                    text: "Pointer locked",
                    timelineStart: 12,
                    duration: 10
                )
                let trailingText = TimelineTextGeometry.trimmed(
                    layer: text,
                    edge: .trailing,
                    translationX: pointerDelta,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                let trailingTextPixels = TimelineTrimGeometry.x(
                    for: trailingText.duration - text.duration,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                #expect(abs(trailingTextPixels - pointerDelta) < 0.000_001)

                let audio = ProjectAudioLayer(
                    url: URL(filePath: "/tmp/pointer-locked.wav"),
                    name: "Pointer locked",
                    timelineStart: 12,
                    duration: 10,
                    sourceStart: 12,
                    sourceDuration: 40
                )
                let leadingAudio = TimelineAudioGeometry.trimmed(
                    layer: audio,
                    edge: .leading,
                    translationX: pointerDelta,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                let leadingAudioPixels = TimelineTrimGeometry.x(
                    for: leadingAudio.timelineStart - audio.timelineStart,
                    contentWidth: contentWidth,
                    projectDuration: projectDuration
                )
                #expect(abs(leadingAudioPixels - pointerDelta) < 0.000_001)
            }
        }
    }

    @Test func emptyTimelineSpaceMapsDirectlyToAClampedTimestamp() {
        #expect(TimelineMetrics.time(for: 250, duration: 10, width: 1_000) == 2.5)
        #expect(TimelineMetrics.time(for: -20, duration: 10, width: 1_000) == 0)
        #expect(TimelineMetrics.time(for: 1_200, duration: 10, width: 1_000) == 10)
    }

    @Test func timelineSnapPrefersThePlayheadOverNearbyLowerPriorityTargets() {
        let match = TimelineSnapEngine.match(
            proposedTime: 10.04,
            anchors: [
                TimelineSnapAnchor(time: 9.99, kind: .boundary),
                TimelineSnapAnchor(time: 10, kind: .playhead),
                TimelineSnapAnchor(time: 10.02, kind: .second),
            ],
            contentWidth: 2_000,
            projectDuration: 20
        )

        #expect(match?.time == 10)
        #expect(match?.kind == .playhead)
    }

    @Test func timelineSnapThresholdStaysConstantInScreenPixelsAtEveryZoom() {
        for contentWidth in [800.0, 2_400.0, 9_600.0] {
            let eightPixelDelta = 8 / contentWidth * 40
            let tenPixelDelta = 10 / contentWidth * 40
            let anchor = TimelineSnapAnchor(time: 12, kind: .boundary)

            #expect(TimelineSnapEngine.match(
                proposedTime: 12 + eightPixelDelta,
                anchors: [anchor],
                contentWidth: contentWidth,
                projectDuration: 40
            )?.time == 12)
            #expect(TimelineSnapEngine.match(
                proposedTime: 12 + tenPixelDelta,
                anchors: [anchor],
                contentWidth: contentWidth,
                projectDuration: 40
            ) == nil)
        }
    }

    @Test func movingTimelineItemsCanSnapEitherTheirStartOrEnd() {
        let result = TimelineSnapEngine.movingMatch(
            start: 4.08,
            duration: 2,
            anchors: [TimelineSnapAnchor(time: 6, kind: .boundary)],
            contentWidth: 1_000,
            projectDuration: 10
        )

        #expect(result?.start == 4)
        #expect(result?.match.time == 6)
    }

    @Test func secondMarksArePreciseWithoutMakingTheWholeTimelineSticky() {
        let second = TimelineSnapAnchor(time: 5, kind: .second)
        let boundary = TimelineSnapAnchor(time: 5, kind: .boundary)
        let fivePixelOffset = 5 / 1_000.0 * 10
        let eightPixelOffset = 8 / 1_000.0 * 10

        #expect(TimelineSnapEngine.match(
            proposedTime: 5 + fivePixelOffset,
            anchors: [second],
            contentWidth: 1_000,
            projectDuration: 10
        ) == nil)
        #expect(TimelineSnapEngine.match(
            proposedTime: 5 + eightPixelOffset,
            anchors: [boundary],
            contentWidth: 1_000,
            projectDuration: 10
        )?.time == 5)
    }

    @Test func audioTransientSnapPointsFindSpacedOnsetsWithoutNoiseChatter() {
        var peaks = [Float](repeating: 0.01, count: 100)
        peaks[10] = 0.85
        peaks[12] = 0.9
        peaks[50] = 0.75

        let times = TimelineAudioTransientGeometry.sourceTimes(peaks: peaks, duration: 10)

        #expect(times.count == 2)
        #expect(abs((times.first ?? 0) - 1) < 0.000_001)
        #expect(abs((times.last ?? 0) - 5) < 0.000_001)
    }

    @Test func clipTimelineStartProvidesAnExactSnapCoordinateAcrossCuts() {
        let mediaID = UUID()
        let first = TimelineClip(mediaID: mediaID, sourceStart: 4, sourceEnd: 7)
        let second = TimelineClip(mediaID: mediaID, sourceStart: 12, sourceEnd: 18)
        let project = EditorProject(clips: [first, second])

        #expect(project.timelineStart(for: first.id) == 0)
        #expect(project.timelineStart(for: second.id) == 3)
        #expect(project.timelineStart(for: UUID()) == nil)
    }

    @Test func timelineMarqueeSelectsMixedItemsInEitherDragDirection() {
        let clip = TimelineSelectionItem.clip(UUID())
        let text = TimelineSelectionItem.text(UUID())
        let audio = TimelineSelectionItem.audio(UUID())
        let frames = [
            TimelineItemFrame(item: clip, frame: CGRect(x: 20, y: 100, width: 120, height: 60)),
            TimelineItemFrame(item: text, frame: CGRect(x: 80, y: 20, width: 90, height: 40)),
            TimelineItemFrame(item: audio, frame: CGRect(x: 240, y: 180, width: 90, height: 40)),
        ]

        let marquee = TimelineMarqueeGeometry.rect(
            from: CGPoint(x: 190, y: 175),
            to: CGPoint(x: 10, y: 10)
        )
        let selection = TimelineMarqueeGeometry.selection(
            intersecting: marquee,
            itemFrames: frames
        )

        #expect(selection == Set([clip, text]))
    }

    @Test func timelineMarqueeSupportsAdditiveAndToggleSelection() {
        let clip = TimelineSelectionItem.clip(UUID())
        let text = TimelineSelectionItem.text(UUID())
        let overlay = TimelineSelectionItem.overlay(UUID())
        let frames = [
            TimelineItemFrame(item: text, frame: CGRect(x: 10, y: 10, width: 30, height: 30)),
            TimelineItemFrame(item: overlay, frame: CGRect(x: 45, y: 10, width: 30, height: 30)),
        ]
        let marquee = CGRect(x: 0, y: 0, width: 80, height: 50)

        #expect(TimelineMarqueeGeometry.selection(
            intersecting: marquee,
            itemFrames: frames,
            base: [clip],
            additive: true
        ) == Set([clip, text, overlay]))
        #expect(TimelineMarqueeGeometry.selection(
            intersecting: marquee,
            itemFrames: frames,
            base: [clip, text],
            toggling: true
        ) == Set([clip, overlay]))
    }

    @Test func silenceDetectionLeavesTightSpeechHandles() async {
        let mediaID = UUID()
        let words = [
            TranscriptWord(mediaID: mediaID, text: "First", start: 0.5, end: 0.8),
            TranscriptWord(mediaID: mediaID, text: "Second", start: 1.6, end: 2.0),
        ]

        let ranges = await AIEditService().silenceRanges(words: words, duration: 3)

        #expect(ranges.count == 3)
        #expect(abs(ranges[0].0 - 0) < 0.000_001)
        #expect(abs(ranges[0].1 - 0.46) < 0.000_001)
        #expect(abs(ranges[1].0 - 0.86) < 0.000_001)
        #expect(abs(ranges[1].1 - 1.56) < 0.000_001)
        #expect(abs(ranges[2].0 - 2.06) < 0.000_001)
        #expect(abs(ranges[2].1 - 3) < 0.000_001)
    }
}
