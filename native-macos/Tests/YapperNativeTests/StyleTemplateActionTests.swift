@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor StyleTestStore: ProjectPersisting {
    var saves: [EditorProject] = []
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws { saves.append(project) }
}

/// Style library templates in the editor: the bundled catalog, applying a
/// split through the same executor Chirpy uses, the split's own settings, and
/// the top visual.
@MainActor
@Suite(.serialized)
struct StyleTemplateActionTests {
    private func fixture() async throws -> (EditorProject, URL) {
        let root = FileManager.default.temporaryDirectory.appending(path: "style-actions-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let takeURL = root.appending(path: "take.mov")
        let clipURL = root.appending(path: "clip.mov")
        try await SyntheticVideo.write(color: NSColor.green.cgColor, size: CGSize(width: 180, height: 320), seconds: 4, to: takeURL)
        try await SyntheticVideo.write(color: NSColor.red.cgColor, size: CGSize(width: 320, height: 180), seconds: 4, to: clipURL)
        let take = try await MediaProbe.inspect(url: takeURL)
        let clip = try await MediaProbe.inspect(url: clipURL)
        let words = [TranscriptWord(mediaID: take.id, text: "hello", start: 0.2, end: 0.6)]
        let project = EditorProject(
            media: [take, clip],
            clips: [
                TimelineClip(mediaID: take.id, sourceStart: 0, sourceEnd: 2),
                TimelineClip(mediaID: take.id, sourceStart: 2, sourceEnd: 4, isLocked: true),
            ],
            transcript: words, captionsEnabled: true,
            captions: [ProjectCaption(mediaID: take.id, text: "hello", sourceStart: 0.2, sourceEnd: 0.6, wordIDs: [words[0].id])],
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

    @Test func bundledCatalogHasTheSplit() throws {
        let catalog = StyleTemplateCatalog.bundled
        let half = try #require(catalog.template("half-and-half"))
        guard case let .split(camera, zoom, focus, top) = half.layout else {
            Issue.record("half-and-half should be a split")
            return
        }
        #expect(camera == StyleBoxPlan(x: 0, y: 0.5, width: 1, height: 0.5))
        #expect(top.height == 0.5)
        #expect(zoom == 1 && focus == 0.3)
        #expect(half.backdrop?.preset == "shapeGrid")
        #expect(half.captions?.style.y == 0.525)
        #expect(catalog.template("talking-head")?.layout == .fullFrame)
    }

    @Test func coverFramingKeepsTheFocusLineInPlace() {
        // A 9:16 take in a 1080 x 960 half covers it twice as tall as the
        // area, so keeping the line 30% down in place slides it 0.2 down.
        let framing = CameraRegionFraming.framing(
            zoom: 1, focusY: 0.3, sourceAspect: 9.0 / 16.0,
            region: .below(seam: 0.5), frameAspect: 9.0 / 16.0
        )
        #expect(abs(framing.y - 0.2) < 0.0001)
        #expect(framing.scale == 1)
        // A wide take fills the half by height: nothing to slide.
        let wide = CameraRegionFraming.framing(
            zoom: 1, focusY: 0.3, sourceAspect: 16.0 / 9.0,
            region: .below(seam: 0.5), frameAspect: 9.0 / 16.0
        )
        #expect(abs(wide.y) < 0.0001)
    }

    @Test func applyingTheSplitSetsLayoutBackdropAndCaptions() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)

        let result = try await run(StyleApplyInput(templateID: "half-and-half", topMediaID: project.media[1].id), in: session)
        #expect(result.status == .applied, "\(result.message)")
        let applied = session.project
        #expect(applied.cameraRegion == .below(seam: 0.5))
        #expect(applied.backdropPreset == .shapeGrid)
        #expect(applied.captionStyleOrDefault.y == 0.525)
        #expect(applied.wordsPerCaptionCard == 3)
        // The unlocked clip is framed for the half; the locked one is left.
        #expect(applied.clips[0].framing != nil)
        #expect(applied.clips[1].framing == nil)
        #expect(result.skippedIDs == [project.clips[1].id])

        let top = try #require(applied.styleTopOverlay)
        #expect(top.mediaID == project.media[1].id)
        #expect(top.x == 0 && top.y == 0 && top.width == 1 && top.height == 0.5)
        // A wide clip cropped to fill a 180 x 160 area: its sides go.
        let crop = try #require(top.crop)
        #expect(crop.height == 1 && crop.width < 1)
    }

    @Test func splitSettingsMoveEverythingWithTheSeam() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        _ = try await run(StyleApplyInput(templateID: "half-and-half", topMediaID: project.media[1].id), in: session)

        let result = try await run(StyleSplitInput(seam: 0.4, cameraZoom: 1.2, cameraFocusY: nil, visualInset: nil), in: session)
        #expect(result.status == .applied, "\(result.message)")
        let moved = session.project
        #expect(moved.cameraRegion == .below(seam: 0.4))
        #expect(abs((moved.styleTopOverlay?.height ?? 0) - 0.4) < 0.0001)
        #expect(abs(moved.captionStyleOrDefault.y - 0.425) < 0.0001)
        #expect(moved.clips[0].framing?.scale == 1.2)
        #expect(result.changes.map(\.property).contains("split.seam"))
    }

    @Test func topVisualSwapsMediaInPlace() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        let refused = try await run(StyleTopVisualInput(mediaID: project.media[1].id), in: session)
        #expect(refused.status == .rejected)

        _ = try await run(StyleApplyInput(templateID: "half-and-half", topMediaID: project.media[1].id), in: session)
        let first = try #require(session.project.styleTopOverlay)
        let result = try await run(StyleTopVisualInput(mediaID: project.media[0].id), in: session)
        #expect(result.status == .applied, "\(result.message)")
        let swapped = try #require(session.project.styleTopOverlay)
        #expect(swapped.id == first.id)
        #expect(swapped.mediaID == project.media[0].id)
        // A tall take in a wide area: its top and bottom go instead.
        #expect(swapped.crop?.width == 1 && (swapped.crop?.height ?? 1) < 1)
        #expect(session.project.overlays?.count == 1)
    }

    @Test func talkingHeadGivesTheCameraTheWholeFrameBack() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        _ = try await run(StyleApplyInput(templateID: "half-and-half", topMediaID: project.media[1].id), in: session)
        let result = try await run(StyleApplyInput(templateID: "talking-head", topMediaID: nil), in: session)
        #expect(result.status == .applied, "\(result.message)")
        #expect(session.project.cameraRegion == nil)
        #expect(session.project.clips[0].framing == nil)
        #expect(session.project.overlays?.isEmpty ?? true)
        #expect(session.project.appliedStyle?.templateID == "talking-head")
        #expect(try await run(StyleSplitInput(seam: 0.4, cameraZoom: nil, cameraFocusY: nil, visualInset: nil), in: session).status == .rejected)
    }

    @Test func unknownTemplateIsRefusedWithTheChoices() async throws {
        let (project, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = await session(project)
        let result = try await run(StyleApplyInput(templateID: "speaker-below", topMediaID: nil), in: session)
        #expect(result.status == .rejected)
        #expect(result.message.contains("half-and-half"))
        #expect(session.project == project)
    }

    /// The camera drawn only below the seam, the top visual above it and the
    /// backdrop nowhere it should not be, in the player's composition and in
    /// a real export.
    @Test func splitRendersTheSameInPreviewAndExport() async throws {
        let (base, root) = try await fixture()
        defer { try? FileManager.default.removeItem(at: root) }
        var project = base
        project.clips = [TimelineClip(mediaID: base.media[0].id, sourceStart: 0, sourceEnd: 4)]
        project.captionsEnabled = false
        let plan = try #require(StyleTemplateCatalog.bundled.template("half-and-half"))
        _ = project.applyStyleLayout(plan)
        project.applyStyleBackdrop(ProjectBackdropInput(color: "#0000FF", preset: nil, presetColors: nil))
        #expect(project.needsStudioCompositor)

        // The camera only: blue backdrop above the seam, green take below.
        let outputURL = root.appending(path: "split.mp4")
        let built = try await CompositionBuilder.build(project: project)
        let preview = AVAssetImageGenerator(asset: built.asset)
        preview.videoComposition = built.playbackVideoComposition
        try await ExportService.export(project: project, to: outputURL)
        let exported = AVAssetImageGenerator(asset: AVURLAsset(url: outputURL))
        for generator in [preview, exported] {
            generator.requestedTimeToleranceBefore = .zero
            generator.requestedTimeToleranceAfter = .zero
            let frame = try generator.copyCGImage(at: CMTime(seconds: 1, preferredTimescale: 600), actualTime: nil)
            func pixel(_ u: Double, _ v: Double) throws -> SampledPixel {
                try #require(frame.sample(x: Int(u * Double(frame.width)), y: Int(v * Double(frame.height))))
            }
            let above = try pixel(0.5, 0.25)
            #expect(above.blue > 200 && above.green < 60, "above the seam: \(above)")
            let below = try pixel(0.5, 0.75)
            #expect(below.green > 200 && below.blue < 60, "below the seam: \(below)")
            let justBelow = try pixel(0.1, 0.53)
            #expect(justBelow.green > 200, "just under the seam: \(justBelow)")
        }
    }
}
