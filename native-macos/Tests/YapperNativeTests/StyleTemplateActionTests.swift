@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor StyleTestStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {}
}

/// Style library templates in the editor: laid over a stretch of words or the
/// whole video, offered through Chirpy as cards, changed afterwards by span,
/// and drawn the same in the player and the export.
@MainActor
@Suite(.serialized)
struct StyleTemplateActionTests {
    /// A 4 s green take with one sentence every second, and a wide red clip
    /// for the top half.
    private func fixture() async throws -> (EditorProject, URL) {
        let root = FileManager.default.temporaryDirectory.appending(path: "style-actions-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let takeURL = root.appending(path: "take.mov")
        let clipURL = root.appending(path: "clip.mov")
        try await SyntheticVideo.write(color: NSColor.green.cgColor, size: CGSize(width: 180, height: 320), seconds: 4, to: takeURL)
        try await SyntheticVideo.write(color: NSColor.red.cgColor, size: CGSize(width: 320, height: 180), seconds: 4, to: clipURL)
        let take = try await MediaProbe.inspect(url: takeURL)
        let clip = try await MediaProbe.inspect(url: clipURL)
        let lines = [("Hello", "there."), ("Signups", "flat."), ("Then", "growth."), ("Bye", "now.")]
        var words: [TranscriptWord] = []
        for (index, line) in lines.enumerated() {
            let t = Double(index)
            words.append(TranscriptWord(mediaID: take.id, text: line.0, start: t + 0.1, end: t + 0.4))
            words.append(TranscriptWord(mediaID: take.id, text: line.1, start: t + 0.5, end: t + 0.9))
        }
        let captions = lines.indices.map { index in
            ProjectCaption(mediaID: take.id, text: "\(lines[index].0) \(lines[index].1)",
                           sourceStart: Double(index) + 0.1, sourceEnd: Double(index) + 0.9,
                           wordIDs: [words[index * 2].id, words[index * 2 + 1].id])
        }
        let project = EditorProject(
            media: [take, clip],
            clips: [TimelineClip(mediaID: take.id, sourceStart: 0, sourceEnd: 4)],
            transcript: words, captionsEnabled: true, captions: captions,
            aspectRatio: .source
        )
        return (project, root)
    }

    private func session(_ project: EditorProject) async -> EditorSession {
        let session = EditorSession(store: StyleTestStore())
        await Task.yield()
        session.updateProject { $0 = project }
        return session
    }

    private func run(_ input: some AppActionInput, in session: EditorSession) async throws -> AppActionResult {
        await session.appActions.execute(try session.actionRequest(input), in: session)
    }

    private func phrase(_ text: String) -> TimelineAnchorInput {
        TimelineAnchorInput(kind: .phrase, time: nil, phrase: text, occurrence: nil, eventID: nil, offset: nil)
    }

    private func captionY(_ project: EditorProject, _ index: Int) -> Double {
        project.storedCaptions[index].resolvedStyle(base: project.captionStyleOrDefault).y
    }

    @Test func bundledCatalogHasTheSplit() throws {
        let half = try #require(StyleTemplateCatalog.bundled.template("half-and-half"))
        guard case let .split(camera, zoom, focus, top) = half.layout else {
            Issue.record("half-and-half should be a split")
            return
        }
        #expect(camera == StyleBoxPlan(x: 0, y: 0.5, width: 1, height: 0.5))
        #expect(top.height == 0.5)
        #expect(zoom == 1 && focus == 0.3)
        #expect(StyleTemplateCatalog.bundled.template("talking-head")?.layout == .fullFrame)
    }

    @Test func coverFramingKeepsTheFocusLineInPlace() {
        let framing = CameraRegionFraming.framing(
            zoom: 1, focusY: 0.3, sourceAspect: 9.0 / 16.0,
            region: .below(seam: 0.5), frameAspect: 9.0 / 16.0
        )
        #expect(abs(framing.y - 0.2) < 0.0001)
        let wide = CameraRegionFraming.framing(
            zoom: 1, focusY: 0.3, sourceAspect: 16.0 / 9.0,
            region: .below(seam: 0.5), frameAspect: 9.0 / 16.0
        )
        #expect(abs(wide.y) < 0.0001)
    }

    @Test func splitCoversOnlyTheWordsItWasAskedFor() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)

        let result = try await run(StyleApplyInput(templateID: "half-and-half", at: phrase("Signups"), until: nil,
                                                   topMediaID: project.media[1].id), in: session)
        #expect(result.status == .applied, "\(result.message)")
        let span = try #require(session.project.resolvedLayoutSpans.first)
        // From "Signups" to the end of its sentence, "flat."
        #expect(abs(span.sourceStart - 1.1) < 0.01 && abs(span.sourceEnd - 1.9) < 0.01)
        #expect(session.project.layoutSpan(atTimeline: 1.5)?.id == span.id)
        #expect(session.project.layoutSpan(atTimeline: 0.5) == nil)
        #expect(session.project.backdropPreset == .shapeGrid)
        // Only the caption spoken inside moves under the seam.
        #expect(abs(captionY(session.project, 1) - 0.525) < 0.0001)
        #expect(captionY(session.project, 0) == captionY(project, 0))
        // The top visual lasts as long as the split, square and cropped to fill.
        let top = try #require(session.project.topOverlay(of: span))
        #expect(abs(top.timelineStart - 1.1) < 0.01 && abs(top.duration - 0.8) < 0.01)
        #expect(top.height == 0.5 && !OverlayFrame.drawsAsCard(top))
        #expect((top.crop?.width ?? 1) < 1)
    }

    @Test func wholeVideoWhenNoWordsAreNamed() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        _ = try await run(StyleApplyInput(templateID: "half-and-half", at: nil, until: nil, topMediaID: nil), in: session)
        let span = try #require(session.project.resolvedLayoutSpans.first)
        #expect(span.sourceStart == 0 && span.sourceEnd == 4)
        #expect(session.project.timelineRanges(of: span) == [0 ... 4])
    }

    @Test func aCutInsideTheSplitKeepsItOnTheSameWords() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        _ = try await run(StyleApplyInput(templateID: "half-and-half", at: phrase("Signups"), until: phrase("Bye"),
                                          topMediaID: nil), in: session)
        let span = try #require(session.project.resolvedLayoutSpans.first)
        session.updateProject { project in
            let id = project.media[0].id
            project.clips = [TimelineClip(mediaID: id, sourceStart: 0, sourceEnd: 2), TimelineClip(mediaID: id, sourceStart: 2.5, sourceEnd: 4)]
        }
        let ranges = session.project.timelineRanges(of: span)
        #expect(ranges.count == 1)
        #expect(abs(ranges[0].lowerBound - 1.1) < 0.01 && abs(ranges[0].upperBound - 2.6) < 0.01)
    }

    @Test func talkingHeadGivesAStretchTheWholeFrameBack() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        _ = try await run(StyleApplyInput(templateID: "half-and-half", at: nil, until: nil, topMediaID: project.media[1].id), in: session)
        let result = try await run(StyleApplyInput(templateID: "talking-head", at: phrase("Then"), until: phrase("Bye"),
                                                   topMediaID: nil), in: session)
        #expect(result.status == .applied, "\(result.message)")
        let span = try #require(session.project.resolvedLayoutSpans.first)
        // The longer side, before "Then", keeps the split and its top visual.
        #expect(span.sourceStart == 0 && abs(span.sourceEnd - 2.1) < 0.01)
        #expect(session.project.layoutSpan(atTimeline: 2.5) == nil)
        #expect(session.project.topOverlay(of: span) != nil)
        #expect(captionY(session.project, 2) == captionY(project, 2))
    }

    @Test func splitSettingsMoveTheSeamTopVisualAndCaptions() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        _ = try await run(StyleApplyInput(templateID: "half-and-half", at: phrase("Signups"), until: nil,
                                          topMediaID: project.media[1].id), in: session)
        let span = try #require(session.project.resolvedLayoutSpans.first)
        let result = try await run(StyleSplitInput(spanID: span.id, seam: 0.4, cameraZoom: 1.2, cameraFocusY: nil, visualInset: nil), in: session)
        #expect(result.status == .applied, "\(result.message)")
        let moved = try #require(session.project.layoutSpan(span.id))
        #expect(moved.region == .below(seam: 0.4) && moved.cameraZoom == 1.2)
        #expect(abs((session.project.topOverlay(of: moved)?.height ?? 0) - 0.4) < 0.0001)
        #expect(abs(captionY(session.project, 1) - 0.425) < 0.0001)
        #expect(result.changes.map(\.property).contains("split.seam"))
    }

    @Test func topVisualSwapsMediaInPlace() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        _ = try await run(StyleApplyInput(templateID: "half-and-half", at: nil, until: nil, topMediaID: project.media[1].id), in: session)
        let span = try #require(session.project.resolvedLayoutSpans.first)
        let first = try #require(session.project.topOverlay(of: span))
        let result = try await run(StyleTopVisualInput(spanID: span.id, mediaID: project.media[0].id), in: session)
        #expect(result.status == .applied, "\(result.message)")
        let swapped = try #require(session.project.topOverlay(of: span))
        #expect(swapped.id == first.id && swapped.mediaID == project.media[0].id)
        #expect(session.project.overlays?.count == 1)
    }

    /// "Split screen when I talk about signups": Chirpy offers cards, the
    /// reply carries them, and tapping one lays the split on those words.
    @Test func chirpyOffersCardsAndATapApplies() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        let offer = StyleOfferInput(at: phrase("Signups"), until: nil, templateIDs: nil)
        session.chirpyPlanner = { _ in
            guard case .object(let fields) = try ActionJSON.encoding(offer) else { throw AppActionError("bad input") }
            return ChirpyPlanReply(message: "Here are some looks.", actions: [.init(action: "editor.styles.offer", arguments: fields)])
        }
        await session.runAssistant(instruction: "split screen when I talk about signups")
        let reply = try #require(session.conversation.messages.last)
        let cards = try #require(reply.offer)
        #expect(cards.templateIDs == ["talking-head", "half-and-half"])
        #expect(session.project.resolvedLayoutSpans.isEmpty)

        await session.chooseOfferedStyle("half-and-half", from: cards, in: reply.id)
        #expect(session.project.layoutSpan(atTimeline: 1.5) != nil)
        #expect(session.conversation.messages.last?.offer?.chosen == "half-and-half")
    }

    @Test func unknownTemplateIsRefusedWithTheChoices() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        let result = try await run(StyleApplyInput(templateID: "speaker-below", at: nil, until: nil, topMediaID: nil), in: session)
        #expect(result.status == .rejected)
        #expect(result.message.contains("half-and-half"))
        #expect(session.project == project)
    }

    /// The split only while its words play: full frame before it, camera
    /// below the seam during it, in the player and in a real export.
    @Test func splitRendersOnlyDuringItsStretchInPreviewAndExport() async throws {
        let (base, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        var project = base
        project.captionsEnabled = false
        let plan = try #require(StyleTemplateCatalog.bundled.template("half-and-half"))
        _ = project.applyStyleTemplate(plan, over: [StyleRange(mediaID: base.media[0].id, source: 1.5 ... 3)])
        project.applyStyleBackdrop(ProjectBackdropInput(color: "#0000FF", preset: nil, presetColors: nil))
        #expect(project.needsStudioCompositor)

        let outputURL = root.appending(path: "split.mp4")
        let built = try await CompositionBuilder.build(project: project)
        let preview = AVAssetImageGenerator(asset: built.asset)
        preview.videoComposition = built.playbackVideoComposition
        try await ExportService.export(project: project, to: outputURL)
        let exported = AVAssetImageGenerator(asset: AVURLAsset(url: outputURL))
        for generator in [preview, exported] {
            generator.requestedTimeToleranceBefore = .zero
            generator.requestedTimeToleranceAfter = .zero
            func pixel(_ seconds: Double, _ u: Double, _ v: Double) throws -> SampledPixel {
                let frame = try generator.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 600), actualTime: nil)
                return try #require(frame.sample(x: Int(u * Double(frame.width)), y: Int(v * Double(frame.height))))
            }
            let before = try pixel(0.7, 0.5, 0.25)
            #expect(before.green > 200 && before.blue < 60, "before the split: \(before)")
            let above = try pixel(2.2, 0.5, 0.25)
            #expect(above.blue > 200 && above.green < 60, "above the seam: \(above)")
            let below = try pixel(2.2, 0.5, 0.75)
            #expect(below.green > 200 && below.blue < 60, "below the seam: \(below)")
            let after = try pixel(3.5, 0.5, 0.25)
            #expect(after.green > 200 && after.blue < 60, "after the split: \(after)")
        }
    }
}
