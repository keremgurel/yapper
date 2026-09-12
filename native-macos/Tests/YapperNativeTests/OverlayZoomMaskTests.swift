@preconcurrency import AVFoundation
import AppKit
import Foundation
import Testing
@testable import YapperNative

private actor OverlayActionStore: ProjectPersisting {
    func load() async throws -> EditorProject? { nil }
    func save(_ project: EditorProject) async throws {}
}

@MainActor
@Suite(.serialized)
struct OverlayZoomMaskTests {
    @Test func smoothZoomPreservesPlacementAndSplitCurve() throws {
        let box = OverlayBox(x: 0.1, y: 0.2, width: 0.8, height: 0.6)
        var overlay = ProjectOverlay(mediaID: UUID(), timelineStart: 3, duration: 4,
            x: box.x, y: box.y, width: box.width, height: box.height)
        overlay.keys = [.init(at: 0, box: box), .init(at: 4, box: .init(x: 0.2, y: 0.3, width: 0.6, height: 0.5))]
        let zoom = OverlayZoom.applying(to: overlay, from: 0.5, to: 2.5, startCrop: .full,
                                       endCrop: .init(x: 0.5, y: 0.25, width: 0.5, height: 0.5))
        let inserted = OverlayKeyTrack.capturing(at: 1, in: zoom)
        let portion = OverlayKeyTrack.portion(of: zoom, from: 1, duration: 2)
        let nearKey = OverlayKeyTrack.portion(of: zoom, from: 0.49, duration: 0.015)
        #expect(abs(OverlayKeyTrack.crop(of: nearKey, at: 0).width - OverlayKeyTrack.crop(of: zoom, at: 0.49).width) < 0.000001)
        #expect(abs(OverlayKeyTrack.crop(of: nearKey, at: 0.015).width - OverlayKeyTrack.crop(of: zoom, at: 0.505).width) < 0.000001)
        for time in stride(from: 0.0, through: 4.0, by: 0.1) {
            #expect(abs(OverlayKeyTrack.box(of: overlay, at: time).x - OverlayKeyTrack.box(of: zoom, at: time).x) < 0.000001)
            #expect(abs(OverlayKeyTrack.crop(of: inserted, at: time).width - OverlayKeyTrack.crop(of: zoom, at: time).width) < 0.000001)
            if time >= 1 && time <= 3 {
                #expect(abs(OverlayKeyTrack.crop(of: portion, at: time - 1).width - OverlayKeyTrack.crop(of: zoom, at: time).width) < 0.000001)
            }
        }
        #expect(OverlayKeyTrack.crop(of: zoom, at: 1).width > 0.95)
        #expect(OverlayKeyTrack.crop(of: zoom, at: 3).width == 0.5)
        let data = try JSONEncoder().encode(zoom)
        #expect(try JSONDecoder().decode(ProjectOverlay.self, from: data) == zoom)
    }

    @Test(arguments: [1.0, 2.0]) func manualMaskAndZoomShareActionsPersistUndoAndRenderTogether(rate: Double) async throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "zoom-mask-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let videoURL = root.appending(path: "base.mov")
        try await SyntheticVideo.write(color: NSColor.black.cgColor, size: CGSize(width: 320, height: 180), seconds: 4, to: videoURL)
        let video = try await MediaProbe.inspect(url: videoURL)
        let context = try #require(CGContext(data: nil, width: 320, height: 180, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(NSColor.red.cgColor); context.fill(CGRect(x: 0, y: 0, width: 160, height: 180))
        context.setFillColor(NSColor.blue.cgColor); context.fill(CGRect(x: 160, y: 0, width: 160, height: 180))
        let image = try #require(context.makeImage())
        let png = try #require(NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]))
        let sourceURL = root.appending(path: "chart.png")
        try png.write(to: sourceURL)
        let media = try await MediaProbe.inspect(url: sourceURL)
        var overlay = ProjectOverlay(mediaID: media.id, timelineStart: 0, duration: 4, x: 0, y: 0, width: 1, height: 1)
        overlay.playbackRate = rate
        overlay.sourceStart = 0.25
        var sibling = overlay; sibling.id = UUID(); sibling.timelineStart = 10
        let session = EditorSession(store: OverlayActionStore(), generatedAssetRoot: root)
        await Task.yield()
        session.updateProject { $0 = EditorProject(media: [video, media], clips: [.init(mediaID: video.id, sourceStart: 0, sourceEnd: 4)], overlays: [overlay, sibling]) }
        if rate == 2 { session.updateProject { $0.backdrop = .init(red: 0.1, green: 0.1, blue: 0.1) } }
        let original = session.project
        let mask = await session.performAppAction(MaskRegionInput(overlayID: overlay.id, regionID: nil, label: "Result",
            rect: .init(x: 0.7, y: 0.4, width: 0.1, height: 0.2), red: 1, green: 1, blue: 1,
            policy: .untilCue, revealTime: 2))
        #expect(mask.status == .applied)
        #expect(session.overlays[1] == sibling)
        #expect(try Data(contentsOf: sourceURL) == png)
        let masked = session.project
        let sceneMedia = try #require(session.media(for: session.overlays[0]))
        let beforeScene = try SceneExportLayer.loadScene(for: sceneMedia)
        #expect(beforeScene.animations.contains { $0.property == .opacity && $0.start == 0.25 + 2 * rate && $0.to == 0 })
        let zoom = await session.performAppAction(OverlayZoomInput(overlayID: overlay.id,
            target: .init(x: 0.5, y: 0.25, width: 0.5, height: 0.5), startTime: 0.5, endTime: 1.5,
            returnStart: 2.8, returnEnd: 3.6))
        #expect(zoom.status == .applied)
        #expect(try SceneExportLayer.loadScene(for: session.media(for: session.overlays[0])!) == beforeScene)
        let inspection = try await TimelineInspectionService.render(project: session.project)
        defer { inspection.discard() }
        let evidence = try await inspection.inspect(times: [0.2, 1.7, 2.5, 3.8])
        let frames = try #require(evidence["frames"] as? [[String: Any]])
        #expect(frames.count == 4)
        if let output = ProcessInfo.processInfo.environment["OVERLAY_QA_OUTPUT"] {
            let folder = URL(fileURLWithPath: output)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            for (index, frame) in frames.enumerated() {
                if let jpeg = frame["jpeg"] as? String, let data = Data(base64Encoded: jpeg) {
                    try data.write(to: folder.appending(path: "frame-\(index).jpg"))
                }
            }
            try beforeScene.encoded().write(to: folder.appending(path: "scene.json"))
        }
        func pixel(_ index: Int, x: Double = 0.5) throws -> NSColor {
            let encoded = try #require(frames[index]["jpeg"] as? String)
            let data = try #require(Data(base64Encoded: encoded))
            let bitmap = try #require(NSBitmapImageRep(data: data))
            return try #require(bitmap.colorAt(x: Int(Double(bitmap.pixelsWide) * x), y: bitmap.pixelsHigh / 2)?.usingColorSpace(.sRGB))
        }
        #expect(try pixel(0, x: 0.25).redComponent > 0.6)
        #expect(try pixel(1).redComponent > 0.7) // White mask follows the zoom.
        #expect(try pixel(1).blueComponent > 0.7)
        #expect(try pixel(2).blueComponent > 0.6) // The original blue pixel is revealed.
        let revealed = try pixel(2)
        #expect(revealed.redComponent < 0.25)
        #expect(try pixel(3, x: 0.25).redComponent > 0.6) // Zoomed back out.
        let unsplit = session.project
        session.selectTimelineItem(.overlay(overlay.id))
        session.seekToTimelineTime(1)
        await session.splitAtPlayhead()
        let right = try #require(session.overlays.first { $0.timelineStart == 1 })
        #expect(right.sourceStart == 0.25 + rate)
        #expect(abs(OverlayKeyTrack.crop(of: right, at: 0.25).width - OverlayKeyTrack.crop(of: unsplit.overlays![0], at: 1.25).width) < 0.000001)
        let splitInspection = try await TimelineInspectionService.render(project: session.project)
        defer { splitInspection.discard() }
        let splitEvidence = try await splitInspection.inspect(times: [2.5])
        let splitFrames = try #require(splitEvidence["frames"] as? [[String: Any]])
        let splitJPEG = try #require(splitFrames.first?["jpeg"] as? String)
        let splitData = try #require(Data(base64Encoded: splitJPEG))
        let splitBitmap = try #require(NSBitmapImageRep(data: splitData))
        let splitPixel = try #require(splitBitmap.colorAt(x: splitBitmap.pixelsWide / 2, y: splitBitmap.pixelsHigh / 2)?.usingColorSpace(.sRGB))
        #expect(splitPixel.blueComponent > 0.6)
        #expect(splitPixel.redComponent < 0.25)
        await session.undo()
        #expect(session.project == unsplit)
        session.selectTimelineItem(.overlay(overlay.id))
        session.seekToTimelineTime(1)
        await session.trimTimelineSelection(toPlayhead: .leading)
        #expect(session.overlays[0].sourceStart == 0.25 + rate)
        await session.undo()
        #expect(session.project == unsplit)
        await session.undo()
        #expect(session.project == masked)
        await session.undo()
        #expect(session.project == original)
        session.player.replaceCurrentItem(with: nil)
    }

    @Test func invalidZoomAndMaskTargetsDoNotMutateProject() async throws {
        let session = EditorSession(store: OverlayActionStore())
        await Task.yield()
        let overlay = ProjectOverlay(mediaID: UUID(), timelineStart: 0, duration: 3)
        session.updateProject { $0.overlays = [overlay] }
        let before = session.project
        let response = await session.performAppAction(OverlayZoomInput(overlayID: overlay.id,
            target: .init(x: 0.9, y: 0, width: 0.5, height: 0.5), startTime: 0, endTime: 4,
            returnStart: nil, returnEnd: nil))
        #expect(response.status == .rejected)
        #expect(session.project == before)
        let missing = await session.performAppAction(MaskRemoveInput(overlayID: UUID(), regionID: "missing"))
        #expect(missing.status == .rejected)
        #expect(session.project == before)
    }
}
