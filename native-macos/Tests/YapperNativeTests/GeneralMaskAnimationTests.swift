import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor MaskAnimationStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {}
}

@MainActor
@Suite(.serialized)
struct GeneralMaskAnimationTests {
    @Test func sourceEvidenceFindsArbitraryRectanglesWithoutNumbers() async throws {
        let canvas = try #require(CGContext(data: nil, width: 600, height: 400, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        canvas.setFillColor(NSColor.black.cgColor); canvas.fill(CGRect(x: 0, y: 0, width: 600, height: 400))
        canvas.setFillColor(NSColor.white.cgColor); canvas.fill(CGRect(x: 120, y: 80, width: 360, height: 240))
        let image = try #require(canvas.makeImage())
        let regions = await OverlayImageAnalysis.shared.regions(in: image)
        let rectangle = try #require(regions.first { $0.kind == "rectangle" })
        #expect(abs(rectangle.rect.x - 0.2) < 0.025)
        #expect(abs(rectangle.rect.y - 0.2) < 0.025)
        #expect(abs(rectangle.rect.width - 0.6) < 0.025)
        #expect(abs(rectangle.rect.height - 0.6) < 0.025)
        if let output = ProcessInfo.processInfo.environment["CHIRPY_VISION_QA_OUTPUT"] {
            let folder = URL(fileURLWithPath: output)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try JSONEncoder().encode(regions).write(to: folder.appending(path: "regions.json"))
            try NSBitmapImageRep(cgImage: image).representation(using: .jpeg, properties: [:])?.write(to: folder.appending(path: "image.jpg"))
        }
    }

    @Test func nonTextMaskUsesSpeechKeysPreservesPixelsAndSynchronizesSound() async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "general-mask-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let keepEvidence = ProcessInfo.processInfo.environment["GENERAL_MASK_QA"] == "1"
        defer { if !keepEvidence { try? FileManager.default.removeItem(at: root) } }
        if keepEvidence { print("MASK_EVIDENCE: \(root.path)") }
        let canvas = try #require(CGContext(data: nil, width: 120, height: 80, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        canvas.setFillColor(NSColor.red.cgColor); canvas.fill(CGRect(x: 0, y: 0, width: 120, height: 80))
        let sourceImage = try #require(canvas.makeImage())
        let bitmap = NSBitmapImageRep(cgImage: sourceImage)
        let bytes = try #require(bitmap.representation(using: .png, properties: [:]))
        let url = root.appending(path: "logo.png"); try bytes.write(to: url)
        let media = try await MediaProbe.inspect(url: url)
        let videoURL = root.appending(path: "speech.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: .init(width: 120, height: 80), seconds: 4, to: videoURL)
        let video = try await MediaProbe.inspect(url: videoURL)
        var overlay = ProjectOverlay(mediaID: media.id, timelineStart: 0, duration: 2, x: 0, y: 0, width: 1, height: 1)
        overlay.sourceStart = 0.25; overlay.playbackRate = 2
        let session = EditorSession(store: MaskAnimationStore(), generatedAssetRoot: root)
        await Task.yield()
        var project = EditorProject(media: [video, media], clips: [.init(mediaID: video.id, sourceStart: 0, sourceEnd: 4, playbackRate: 2)], overlays: [overlay])
        project.transcript = [.init(mediaID: video.id, text: "our", start: 1, end: 1.2), .init(mediaID: video.id, text: "logo", start: 1.2, end: 1.5)]
        session.updateProject { $0 = project }
        #expect(bitmap.colorAt(x: 60, y: 40)?.usingColorSpace(.sRGB)?.redComponent == 1)
        let before = session.project
        func at(_ offset: Double) -> TimelineAnchorInput {
            .init(kind: .phrase, time: nil, phrase: "our logo", occurrence: nil, eventID: nil, offset: offset)
        }
        let input = MaskRegionInput(overlayID: overlay.id, regionID: nil, label: "Logo",
            rect: .init(x: 0.2, y: 0.2, width: 0.6, height: 0.6), red: 1, green: 1, blue: 1,
            policy: nil, revealTime: nil, opacityKeys: [
                .init(at: at(0), opacity: 1, easing: .smooth), .init(at: at(0.2), opacity: 0, easing: .linear),
                .init(at: at(0.6), opacity: 0, easing: .smooth), .init(at: at(0.8), opacity: 1, easing: nil)])
        let result = await session.performAppAction(input)
        #expect(result.status == .applied)
        let masked = session.project
        let revised = try #require(session.media(for: session.overlays[0]))
        let region = try #require(revised.generated?.revealRegions?.first)
        #expect(region.text.isEmpty) // No OCR or number-recognition dependency.
        #expect(region.opacityKeys?.count == 4)
        #expect(abs(try #require(region.opacityKeys?.first?.time) - 1.25) < 1e-8)
        #expect(try Data(contentsOf: url) == bytes)
        let events = try await session.animationEvents()
        let transparent = try #require(events.first { $0.value == 0 })
        #expect(abs(transparent.timelineTime - 0.7) < 1e-8)
        let sound = SoundAtInput(effectID: "mouse-click", at: [.init(kind: .event, time: nil,
            phrase: nil, occurrence: nil, eventID: transparent.id, offset: nil)])
        #expect(await session.performAppAction(sound).status == .applied)
        #expect(session.project.overlays == masked.overlays)
        #expect(abs(try #require(session.project.audioLayers?.first?.timelineStart) - 0.7) < 1e-8)
        #expect(await session.performAppAction(sound).status == .unchanged)
        await session.undo()
        #expect(session.project == masked)
        // Geometry-only edits retain the complete arbitrary animation.
        let geometry = MaskRegionInput(overlayID: overlay.id, regionID: region.id, label: "Logo",
            rect: .init(x: 0.1, y: 0.2, width: 0.6, height: 0.6), red: 1, green: 1, blue: 1,
            policy: nil, revealTime: nil, opacityKeys: nil)
        #expect(await session.performAppAction(geometry).status == .applied)
        let edited = try #require(session.media(for: session.overlays[0]))
        #expect(edited.generated?.revealRegions?.first?.opacityKeys == region.opacityKeys)
        await session.undo()
        let inspection = try await TimelineInspectionService.render(project: session.project)
        defer { inspection.discard() }
        let evidence = try await inspection.inspect(times: [0.2, 0.9, 1.6])
        let frames = try #require(evidence["frames"] as? [[String: Any]])
        for (index, frame) in frames.enumerated() {
            let jpeg = try #require(frame["jpeg"] as? String)
            let data = try #require(Data(base64Encoded: jpeg))
            if keepEvidence { try data.write(to: root.appending(path: "frame-\(index).jpg")) }
            let image = try #require(NSBitmapImageRep(data: data))
            let color = try #require(image.colorAt(x: image.pixelsWide / 2, y: image.pixelsHigh / 2)?.usingColorSpace(.sRGB))
            #expect(color.redComponent > 0.7, "Frame \(index)")
            #expect(index == 1 ? color.greenComponent < 0.2 : color.greenComponent > 0.7)
        }
        await session.undo()
        #expect(session.project == before)
        let unchanged = session.project
        let invalid = MaskRegionInput(overlayID: overlay.id, regionID: nil, label: "Logo", rect: input.rect,
            red: 1, green: 1, blue: 1, policy: nil, revealTime: nil,
            opacityKeys: [.init(at: at(1), opacity: 0, easing: nil), .init(at: at(0), opacity: 1, easing: nil)])
        #expect(await session.performAppAction(invalid).status == .rejected)
        #expect(session.project == unchanged)
        let catalog = session.appActions.planningDescriptors.map(\.id)
        #expect(!catalog.contains("editor.reveals.setPolicy"))
        #expect(!catalog.contains("editor.video.punchIn"))
        #expect(catalog.contains("editor.masks.setRegion"))
        let context = try await session.chirpyContext()
        #expect(context["reveals"] == nil)
        #expect(context["animationEvents"] != nil)
        session.player.replaceCurrentItem(with: nil)
    }
}
