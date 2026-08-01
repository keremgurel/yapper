import Foundation
import Testing
@testable import YapperNative

struct EditorProjectTests {
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

    @Test func textLayersRoundTripAndRespectTheirTimelineWindow() throws {
        let layer = ProjectTextLayer(
            text: "A precise hook",
            timelineStart: 1.25,
            duration: 3.5,
            x: 0.4,
            y: 0.2,
            width: 0.72,
            fontScale: 0.065,
            style: .blackCard,
            font: .editorial
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

    @Test func allBuiltInSoundEffectsAreRealNonSilentAudio() {
        #expect(SoundEffectDescriptor.library.count == 10)
        #expect(Set(SoundEffectDescriptor.library.map(\.id)).count == 10)
        for effect in SoundEffectDescriptor.library {
            let samples = SoundEffectService.render(effect)
            #expect(samples.count == Int((effect.duration * SoundEffectService.sampleRate).rounded()))
            #expect((samples.map { abs($0) }.max() ?? 0) > 0.5)
        }
        #expect(SoundEffectDescriptor.library.first(where: { $0.id == "mechanical-keyboard" })?.duration == 5)
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
            fontScale: 0.05
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
        #expect(TimelineZoomGeometry.scaled(230, by: 2) == 240)
        #expect(TimelineZoomGeometry.scaled(20, by: 0.2) == 18)

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
}
